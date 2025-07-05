const { ethers } = require("hardhat");
const { expect } = require("chai");
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
      const ethAmount = ethers.parseEther("1.0");
      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);
      const CSBTokenAmount = expectedCSBTokenToGet;

      const CSBTokenToETH = CSBTokenAmount / BigInt(3000);

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

      // Test unlock collateral
      await expect(loanManager.connect(user1).unlockCollateral(CSBTokenAmount))
        .to.emit(loanManager, "TransferTokenCSB")
        .withArgs(user1.address, await stableToken.getAddress(), CSBTokenAmount)
        .to.emit(loanManager, "DecreaseCollateral")
        .withArgs(user1.address, CSBTokenToETH);

      // Check Token Balance
      const user1CSBTokenBalanceAfter = await stableToken.balanceOf(user1);
      await expect(user1CSBTokenBalanceAfter).to.equal(
        user1CSBTokenBalanceBefore - CSBTokenAmount
      );

      // Check user collateral in CollateralVault
      const userCollateralAfter = await collateralVault.userCollateral(user1);
      await expect(userCollateralAfter).to.equal(
        userCollateralBefore - CSBTokenToETH
      );
    });

    it("Admin can't call a unlock collateral vault", async () => {
      const ethAmount = ethers.parseEther("1.0");
      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);

      await expect(
        loanManager.connect(deployer).unlockCollateral(expectedCSBTokenToGet)
      ).to.be.reverted;
    });
  });
});
