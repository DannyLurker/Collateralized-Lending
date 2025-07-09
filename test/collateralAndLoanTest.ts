const { ethers } = require("hardhat");
const { expect } = require("chai");
import { isAddress } from "ethers";
import {
  StableToken,
  CollateralVault,
  LoanManager,
  LoanSystemFactory,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Collateral And Loan", () => {
  let deployer: HardhatEthersSigner,
    user1: HardhatEthersSigner,
    stableToken: StableToken,
    collateralVault: CollateralVault,
    loanManager: LoanManager,
    loanSystemFactory: LoanSystemFactory;

  beforeEach(async () => {
    const [deployerSign, user1Sign] = await ethers.getSigners();
    deployer = deployerSign;
    user1 = user1Sign;

    const LoanSystemFactory = await ethers.getContractFactory(
      "LoanSystemFactory"
    );

    loanSystemFactory = await LoanSystemFactory.deploy();
    loanSystemFactory.waitForDeployment();

    await loanSystemFactory.connect(deployer).deployLoanSystem();

    const getDeployedSystem = await loanSystemFactory.getDeployedSystem(
      deployer.address
    );

    // .getContractAt : merupakan sebuah method yang di gunakan untuk mendapatkan instance dari sebuah smart contract yang telah di deploy kedalam blockchain

    stableToken = await ethers.getContractAt(
      "StableToken",
      getDeployedSystem.stableToken
    );

    collateralVault = await ethers.getContractAt(
      "CollateralVault",
      getDeployedSystem.collateralVault
    );

    loanManager = await ethers.getContractAt(
      "LoanManager",
      getDeployedSystem.loanManager
    );

    await stableToken
      .connect(deployer)
      .approve(loanManager, await stableToken.totalSupply());
  });

  describe("Deposit Collateral", async () => {
    function getETHtoUSD(ethAmount: bigint) {
      const usdValue = (ethAmount * BigInt(3000)) / BigInt(1e18);
      return usdValue * BigInt(1e18);
    }

    it("Only user can make a deposit collateral", async () => {
      const ethAmount = ethers.parseEther("1.0");

      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);

      // Check total supply
      const totalSupply = await stableToken.totalSupply();
      expect(totalSupply).to.be.greaterThan(expectedCSBTokenToGet);

      // Test the deposit
      await expect(
        loanManager.connect(user1).depositCollateral({ value: ethAmount })
      )
        .to.emit(loanManager, "DepositCollateral")
        .withArgs(user1.address, await collateralVault.getAddress(), ethAmount)
        .and.to.emit(loanManager, "TransferTokenCSB")
        .withArgs(
          await stableToken.getAddress(), // from stableToken contract
          user1.address, // to user
          expectedCSBTokenToGet
        );

      // Verify user received tokens
      const userBalance = await stableToken.balanceOf(user1.address);
      expect(userBalance).to.equal(expectedCSBTokenToGet);

      // Verify collateral was recorded
      const userCollateral = await collateralVault.userCollateral(
        user1.address
      );
      expect(userCollateral).to.equal(ethAmount);
    });

    it("Loan manager can't make a deposit", async () => {
      const ethAmount = ethers.parseEther("1.0");
      expect(
        await loanManager
          .connect(deployer)
          .depositCollateral({ value: ethAmount })
      ).to.be.revertedWith("Only user can call this");
    });

    it("Only user can make an unlock collateral", async () => {
      const ethAmount = ethers.parseEther("2.0");
      // Sudah 18desimal
      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);
      const CSBTokenAmount = expectedCSBTokenToGet;

      // First, deposit collateral to get CSB tokens
      await expect(
        loanManager.connect(user1).depositCollateral({ value: ethAmount })
      )
        .to.emit(loanManager, "DepositCollateral")
        .withArgs(user1.address, await collateralVault.getAddress(), ethAmount)
        .and.to.emit(loanManager, "TransferTokenCSB")
        .withArgs(
          await stableToken.getAddress(),
          user1.address,
          expectedCSBTokenToGet
        );

      // Now user1 has CSB tokens, so they can approve the loan manager to spend their tokens
      await stableToken
        .connect(user1)
        .approve(loanManager, expectedCSBTokenToGet);

      const userCollateralBefore = await collateralVault.userCollateral(user1);
      const user1CSBTokenBalanceBefore = await stableToken.balanceOf(user1);
      const unlockCollateralWithCSB =
        CSBTokenAmount - BigInt(3000) * BigInt(1e18);
      const CSBtoETHWithUnlockCollateral =
        unlockCollateralWithCSB / BigInt(3000);

      // Test unlock collateral
      await expect(
        loanManager.connect(user1).unlockCollateral(unlockCollateralWithCSB)
      )
        .to.emit(loanManager, "TransferTokenCSB")
        .withArgs(
          user1.address,
          await stableToken.getAddress(),
          unlockCollateralWithCSB
        )
        .and.to.emit(loanManager, "DecreaseCollateral")
        .withArgs(user1.address, CSBtoETHWithUnlockCollateral);

      // Check Token Balance
      const user1CSBTokenBalanceAfter = await stableToken.balanceOf(user1);
      await expect(user1CSBTokenBalanceAfter).to.equal(
        user1CSBTokenBalanceBefore - unlockCollateralWithCSB
      );

      // Check user collateral in CollateralVault
      const userCollateralAfter = await collateralVault.userCollateral(user1);
      await expect(userCollateralAfter).to.equal(
        userCollateralBefore - CSBtoETHWithUnlockCollateral
      );
    });

    it("Admin can't call a unlock collateral vault", async () => {
      const ethAmount = ethers.parseEther("1.0");
      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);

      await expect(
        loanManager.connect(deployer).unlockCollateral(expectedCSBTokenToGet)
      ).to.be.reverted;
    });

    it("Liquidation", async () => {
      const ethAmount = ethers.parseEther("2.0");
      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);

      // 1. User deposit collateral
      await expect(
        loanManager.connect(user1).depositCollateral({ value: ethAmount })
      )
        .to.emit(loanManager, "DepositCollateral")
        .withArgs(user1.address, await collateralVault.getAddress(), ethAmount)
        .and.to.emit(loanManager, "TransferTokenCSB")
        .withArgs(
          await stableToken.getAddress(),
          user1.address,
          expectedCSBTokenToGet
        );

      // 2. Check who is currently set as loanManager in CollateralVault
      const currentLoanManagerAddress =
        await collateralVault.loanManagerAddress();
      console.log("Current loanManager address:", currentLoanManagerAddress);
      console.log("Deployer address:", deployer.address);
      console.log(
        "Actual LoanManager contract address:",
        await loanManager.getAddress()
      );

      // 3. Fix the loanManager address if it's wrong (due to factory bug)
      if (currentLoanManagerAddress === deployer.address) {
        // Reset to the actual loanManager contract
        await collateralVault
          .connect(deployer)
          .setLoanManager(await loanManager.getAddress());
        console.log(
          "Fixed loanManager address to:",
          await loanManager.getAddress()
        );
      }

      // 4. Check initial state
      const userCollateralBefore = await collateralVault.userCollateral(
        user1.address
      );
      const healthFactorBefore = await collateralVault.getHealthFactor(
        user1.address
      );

      console.log(
        "Initial user collateral:",
        ethers.formatEther(userCollateralBefore)
      );
      console.log(
        "Initial health factor:",
        ethers.formatEther(healthFactorBefore)
      );

      // 5. For testing purposes, we'll temporarily set deployer as loanManager
      // so we can call liquidation directly
      await collateralVault.connect(deployer).setLoanManager(deployer.address);

      // 6. Verify liquidation should NOT work initially
      await expect(
        collateralVault.connect(deployer).liquidation(user1.address)
      ).to.be.revertedWithCustomError(collateralVault, "HealthFactorStillSafe");

      // 7. Create liquidation scenario by minting additional CSB tokens to the user
      const additionalCSB = ethers.parseEther("4000"); // Large amount to trigger liquidation

      // Mint additional CSB tokens to user1 to simulate increased debt
      await stableToken.connect(deployer).mint(user1.address, additionalCSB);

      // 8. Check health factor after creating liquidation scenario
      const healthFactorAfter = await collateralVault.getHealthFactor(
        user1.address
      );
      console.log(
        "Health factor after increasing debt:",
        ethers.formatEther(healthFactorAfter)
      );

      // Verify health factor is now below liquidation threshold (0.9)
      expect(healthFactorAfter).to.be.lessThan(ethers.parseEther("0.9"));

      // 9. Get user collateral amount before liquidation
      const userCollateralForLiquidation = await collateralVault.userCollateral(
        user1.address
      );

      // 10. Now liquidation should work
      await expect(collateralVault.connect(deployer).liquidation(user1.address))
        .to.emit(collateralVault, "Liquidation")
        .withArgs(user1.address, userCollateralForLiquidation);

      // 11. Verify liquidation effects
      const userCollateralAfter = await collateralVault.userCollateral(
        user1.address
      );
      console.log(
        "User collateral after liquidation:",
        ethers.formatEther(userCollateralAfter)
      );

      // Should be 0 after full liquidation
      expect(userCollateralAfter).to.equal(0);

      // 12. Restore the correct loanManager address
      await collateralVault
        .connect(deployer)
        .setLoanManager(await loanManager.getAddress());
    });
  });
});
