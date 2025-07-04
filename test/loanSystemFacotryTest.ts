const { ethers } = require("hardhat");
const { expect } = require("chai");
import { LoanSystemFactory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// NOTES :
// ✅ GUNAKAN tx.wait() untuk:
// State-changing functions
// Contract deployment dalam test
// Minting, burning, transfers
// Approve, permit operations

describe("LoanSystemFactory", function () {
  let loanSystemFactory: LoanSystemFactory;
  let deployer: HardhatEthersSigner,
    user1: HardhatEthersSigner,
    user2: HardhatEthersSigner;

  beforeEach(async function () {
    // Get signers
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy LoanSystemFactory
    const LoanSystemFactory = await ethers.getContractFactory(
      "LoanSystemFactory"
    );
    loanSystemFactory = await LoanSystemFactory.deploy();
    await loanSystemFactory.waitForDeployment();
  });

  describe("Deployment", () => {
    it("Should deploy successfully", async function () {
      expect(await loanSystemFactory.getAddress()).to.be.properAddress;
    });
  });

  describe("deployLoanSystem function", () => {
    it("should return valid contract addresses", async () => {
      const result = await loanSystemFactory
        .connect(deployer)
        .deployLoanSystem();

      // Check transaction success
      expect(result).to.not.be.undefined;

      // Check stored data in mapping
      const deployedSystem = await loanSystemFactory.getDeployedSystem(
        deployer.address
      );

      await expect(deployedSystem.stableToken).to.not.equal(ethers.ZeroAddress);

      await expect(deployedSystem.collateralVault).to.not.equal(
        ethers.ZeroAddress
      );

      await expect(deployedSystem.loanManager).to.not.equal(ethers.ZeroAddress);
    });

    it("Should return an emit", async () => {
      await expect(
        loanSystemFactory.connect(deployer).deployLoanSystem()
      ).to.emit(loanSystemFactory, "SystemDeployed");
    });

    it("should store addresses in deployedSystems mapping", async () => {
      await loanSystemFactory.connect(deployer).deployLoanSystem();

      const deployedSystemsMapping = loanSystemFactory
        .connect(deployer)
        .deployedSystems(deployer);

      await expect((await deployedSystemsMapping).stableToken).to.not.equal(
        ethers.ZeroAddress
      );
      await expect((await deployedSystemsMapping).collateralVault).to.not.equal(
        ethers.ZeroAddress
      );
      await expect((await deployedSystemsMapping).loanManager).to.not.equal(
        ethers.ZeroAddress
      );
    });

    it("should set up cross-contract relationships", async () => {
      const tx = await loanSystemFactory.connect(deployer).deployLoanSystem();

      // tx.wait() lah yang akan menunda eksekusi kode Anda selanjutnya sampai transaksi tersebut benar-benar diproses oleh validator/miner dan ditambahkan ke dalam blok blockchain. Tanpa tx.wait(), ada risiko kode Anda mencoba berinteraksi dengan kontrak atau data yang belum sepenuhnya diperbarui di blockchain, menyebabkan kesalahan atau hasil yang tidak konsisten.
      await tx.wait();

      const deployedSystem = loanSystemFactory
        .connect(deployer)
        .getDeployedSystem(deployer.address);

      const stableTokenInstance = await ethers.getContractAt(
        "StableToken",
        (
          await deployedSystem
        ).stableToken
      );

      const CollateralVaultInstance = await ethers.getContractAt(
        "CollateralVault",
        (
          await deployedSystem
        ).collateralVault
      );
      const LoanManagerInstance = await ethers.getContractAt(
        "LoanManager",
        (
          await deployedSystem
        ).loanManager
      );

      await expect(await CollateralVaultInstance.stableToken()).to.equal(
        await stableTokenInstance.getAddress()
      );

      await expect(await LoanManagerInstance.stableToken()).to.equal(
        await stableTokenInstance.getAddress()
      );

      await expect(await LoanManagerInstance.collateralVault()).to.equal(
        await CollateralVaultInstance.getAddress()
      );

      const MINTER_ROLE = await stableTokenInstance.MINTER_ROLE();
      const hasMinterRole = await stableTokenInstance.hasRole(
        MINTER_ROLE,
        (
          await deployedSystem
        ).loanManager
      );
      expect(hasMinterRole).to.be.true;

      const DEFAULT_ADMIN_ROLE = await stableTokenInstance.DEFAULT_ADMIN_ROLE();
      const hasAdminRole = await stableTokenInstance.hasRole(
        DEFAULT_ADMIN_ROLE,
        deployer.address
      );
      expect(hasAdminRole).to.be.true;
    });

    it("Be able to do multiple deployment", async () => {
      // Helper function to validate deployed system
      const validateDeployedSystem = async (
        systemMapping: Promise<
          [string, string, string] & {
            stableToken: string;
            collateralVault: string;
            loanManager: string;
          }
        >
      ) => {
        const system = await systemMapping;
        await expect(system.stableToken).to.not.equal(ethers.ZeroAddress);
        await expect(system.collateralVault).to.not.equal(ethers.ZeroAddress);
        await expect(system.loanManager).to.not.equal(ethers.ZeroAddress);
      };

      // Deploy system for deployer
      await loanSystemFactory.connect(deployer).deployLoanSystem();
      const deployerDeployedSystemsMapping = loanSystemFactory
        .connect(deployer)
        .deployedSystems(deployer);

      await validateDeployedSystem(deployerDeployedSystemsMapping);

      // Deploy system for user1
      await loanSystemFactory.connect(user1).deployLoanSystem();
      const user1DeployedSystemsMapping = loanSystemFactory
        .connect(user1)
        .deployedSystems(user1);

      await validateDeployedSystem(user1DeployedSystemsMapping);

      // Deploy system for user2
      await loanSystemFactory.connect(user2).deployLoanSystem();
      const user2DeployedSystemsMapping = loanSystemFactory
        .connect(user2)
        .deployedSystems(user2);

      await validateDeployedSystem(user2DeployedSystemsMapping);

      // Optional: Verify that each user has different deployed systems
      const deployerSystem = await deployerDeployedSystemsMapping;
      const user1System = await user1DeployedSystemsMapping;
      const user2System = await user2DeployedSystemsMapping;

      // Ensure each deployment created unique contracts
      expect(deployerSystem.stableToken).to.not.equal(user1System.stableToken);
      expect(deployerSystem.stableToken).to.not.equal(user2System.stableToken);
      expect(user1System.stableToken).to.not.equal(user2System.stableToken);
    });
  });
});
