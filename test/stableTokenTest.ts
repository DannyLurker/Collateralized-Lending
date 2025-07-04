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
        ).to.be.revertedWith("No minter role");
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
        ).to.be.revertedWith("No pauser role");
      });

      it("An Account with a PAUSER_ROLE shouldn't be able to make a unpuase", async () => {
        await stableTokenContract.connect(deployer).pause();

        await expect(
          stableTokenContract.connect(user1).unpause()
        ).to.be.revertedWith("No pauser role");
      });
    });

    describe("TranferForm and Approval", () => {
      it("Deployer should be able make a transferForm to user1", async () => {
        //Amount to transfer
        const amountToTransfer = ethers.parseUnits("1000", 18);

        // Approval
        expect(
          await stableTokenContract
            .connect(deployer)
            .approve(deployer.address, amountToTransfer)
        );

        // Check Supply
        const totalSupplyStableTokenContractbefore =
          await stableTokenContract.totalSupply();

        const totalCOLStableUserAddressBefore =
          await stableTokenContract.balanceOf(user1.address);

        expect(await stableTokenContract.totalSupply()).to.be.gte(
          amountToTransfer
        );

        // TransferFrom
        expect(
          await stableTokenContract.transferFrom(
            deployer.address,
            user1.address,
            amountToTransfer
          )
        ).to.emit(stableTokenContract, "TransferToken");

        // Kenapa tidak berkurang supply nya ? Karena kita menggunakan function transferForm yang dimana hanya memindahkan supply, supply akan berkurang jika terjadi burn, dan akan bertambah jika terjadi mint
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

        // Kenapa tidak berkurang supply nya ? Karena kita menggunakan function transferForm yang dimana hanya memindahkan supply, supply akan berkurang jika terjadi burn, dan akan bertambah jika terjadi mint
        console.log(
          "Total supply Stable Token contract after: ",
          totalSupplyStableTokenContractAfter
        );

        console.log(
          "Total COLStable user address after : ",
          totalCOLStableUserAddressAfter
        );
      });
    });
  });
});
