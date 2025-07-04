const { ethers } = require("hardhat");
const { expect } = require("chai");
import { getDefaultProvider } from "ethers";
import {
  StableToken,
  CollateralVault,
  LoanManager,
  LoanSystemFactory,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { bigint } from "hardhat/internal/core/params/argumentTypes";

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
  });

  describe("Deposit Collateral", async () => {
    function getETHtoUSD(ethAmount: bigint) {
      return (ethAmount * (BigInt(3000) * BigInt(1e8))) / BigInt(1e26);
    }

    it("Only user can make a deposit collateral", async () => {
      const ethAmount = ethers.parseEther("1.0");
      const ETHCollateralVualtBefore = ethers.provider.getBalance(
        await collateralVault.getAddress()
      );

      const expectedCSBTokenToGet = getETHtoUSD(ethAmount);
      const amountTokenToTransfer = ethers.parseUnits(
        expectedCSBTokenToGet.toString(),
        18
      );

      await stableToken
        .connect(deployer)
        .approve(deployer, amountTokenToTransfer);

      expect(
        await loanManager.connect(user1).depositCollateral({ value: ethAmount })
      )
        .to.emit(loanManager, "DepositCollateral")
        .withArgs(user1.address, await collateralVault.getAddress(), ethAmount)
        .to.emit(loanManager, "TransferTokenCSB")
        .withArgs(
          deployer.address,
          user1.address,
          BigInt(amountTokenToTransfer)
        );
    });
  });
});
