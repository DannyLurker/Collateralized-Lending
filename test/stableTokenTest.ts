const { ethers } = require("hardhat");
const { expect } = require("chai");
import { StableToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("StableToken Contract", () => {
  let deployer: HardhatEthersSigner, user1: HardhatEthersSigner;
  let stableTokenContract: StableToken;

  beforeEach(async () => {
    const [deployerSign, user1Sign] = await ethers.getSigners();
    deployer = deployerSign;
    user1 = user1Sign;

    const StableToken = await ethers.getContractFactory("StableToken");

    stableTokenContract = await StableToken.deploy(deployerSign);
    stableTokenContract.waitForDeployment();
  });

  describe("Deployment Stable Token Contract", () => {
    it("should deploy and have a valid address", async () => {
      expect(await stableTokenContract.getAddress()).to.be.properAddress;
    });
  });

  describe("Function Test", () => {
    describe("MINT funciton", () => {
      it("An account with a MINTER_ROLE should be able to make a mint", async () => {
        const amountToMint = ethers.parseUnits("100", 18);
        expect(
          await stableTokenContract.connect(deployer).mint(user1, amountToMint)
        );

        const user1Balance = await stableTokenContract.balanceOf(user1);
        expect(user1Balance).to.equal(amountToMint);
        console.log("Token that have sended to User1: ", amountToMint);
        console.log("User 1 balance: ", user1Balance);
      });

      it("An account without a MINTER_ROlE can't make a mint", async () => {
        const amountToMint = ethers.parseUnits("100", 18);
        await expect(
          stableTokenContract.connect(user1).mint(deployer, amountToMint)
        ).to.be.revertedWith("No minter or admin role");
      });
    });

    describe("Pasue and Unpause", () => {
      it("An Account with a PAUSER_ROLE should be able to make a puase", async () => {
        await expect(stableTokenContract.connect(deployer).pause())
          .to.emit(stableTokenContract, "Pause")
          .withArgs(deployer.address);
      });

      it("An Account with a PAUSER_ROLE should be able to make a unpuase", async () => {
        await stableTokenContract.connect(deployer).pause();

        await expect(stableTokenContract.connect(deployer).unpause())
          .to.emit(stableTokenContract, "Unpause")
          .withArgs(deployer.address);
      });

      it("An Account without a PAUSER_ROLE shouldn't be able to make a puase", async () => {
        await expect(
          stableTokenContract.connect(user1).pause()
        ).to.be.revertedWith("No pauser or admin role");
      });

      it("An Account with a PAUSER_ROLE shouldn't be able to make a unpuase", async () => {
        await stableTokenContract.connect(deployer).pause();

        await expect(
          stableTokenContract.connect(user1).unpause()
        ).to.be.revertedWith("No pauser or admin role");
      });
    });

    describe("TranferForm and Approval", () => {
      it("Deployer should be able make a transferForm to user1", async () => {
        //Amount to transfer
        const amountToTransfer = ethers.parseUnits("1000", 18);

        // Get contract address
        const contractAddress = await stableTokenContract.getAddress();

        // FIXED: Use the new approveContractTransfer function
        // This allows the contract to approve the deployer to spend tokens from the contract
        await stableTokenContract
          .connect(deployer)
          .approveContractTransfer(deployer.address, amountToTransfer);

        // Check Supply
        const totalSupplyStableTokenContractbefore =
          await stableTokenContract.totalSupply();

        const totalCOLStableUserAddressBefore =
          await stableTokenContract.balanceOf(user1.address);

        expect(await stableTokenContract.totalSupply()).to.be.gte(
          amountToTransfer
        );

        // FIXED: Use the contract address as the 'from' address
        // TransferFrom - now this should work because we approved the deployer to spend from contract
        await expect(
          stableTokenContract.transferFrom(
            contractAddress,
            user1.address,
            amountToTransfer
          )
        ).to.emit(stableTokenContract, "Transfer"); // Use the standard ERC20 Transfer event

        // Check balances after transfer
        const totalSupplyStableTokenContractAfter =
          await stableTokenContract.totalSupply();

        const totalCOLStableUserAddressAfter =
          await stableTokenContract.balanceOf(user1.address);

        // Check with console.log()
        console.log(
          "Total supply stable token contract before: ",
          totalSupplyStableTokenContractbefore
        );

        console.log(
          "Total COLStable user address before : ",
          totalCOLStableUserAddressBefore
        );

        console.log(
          "Total supply Stable Token contract after: ",
          totalSupplyStableTokenContractAfter
        );

        console.log(
          "Total COLStable user address after : ",
          totalCOLStableUserAddressAfter
        );

        // Verify the transfer worked
        expect(totalCOLStableUserAddressAfter).to.equal(
          totalCOLStableUserAddressBefore + amountToTransfer
        );
      });

      it("Regular user should be able to approve and transfer their own tokens", async () => {
        // First, mint some tokens to user1
        const amountToMint = ethers.parseUnits("500", 18);
        await stableTokenContract.connect(deployer).mint(user1, amountToMint);

        // Now user1 should be able to approve and transfer normally
        const amountToTransfer = ethers.parseUnits("100", 18);

        // User1 approves deployer to spend their tokens
        await stableTokenContract
          .connect(user1)
          .approve(deployer.address, amountToTransfer);

        // Deployer transfers from user1 to deployer
        await expect(
          stableTokenContract.transferFrom(
            user1.address,
            deployer.address,
            amountToTransfer
          )
        ).to.emit(stableTokenContract, "Transfer");

        // Verify balances
        const user1Balance = await stableTokenContract.balanceOf(user1.address);
        const deployerBalance = await stableTokenContract.balanceOf(
          deployer.address
        );

        expect(user1Balance).to.equal(amountToMint - amountToTransfer);
        expect(deployerBalance).to.equal(amountToTransfer);
      });
    });
  });
});
