// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./StableToken.sol";
import "./CollateralVault.sol";
import "./LoanManager.sol";

contract LoanSystemFactory {
    event SystemDeployed(
        address indexed stableToken,
        address indexed collateralVault,
        address indexed loanManager,
        address owner
    );

    struct DeployedContracts {
        address stableToken;
        address collateralVault;
        address loanManager;
    }

    mapping(address => DeployedContracts) public deployedSystems;

    function deployLoanSystem()
        external
        returns (
            address stableTokenAddress,
            address collateralVaultAddress,
            address loanManagerAddress
        )
    {
        // 1. Deploy StableToken dengan Factory sebagai admin sementara
        StableToken stableToken = new StableToken(address(this));
        stableTokenAddress = address(stableToken);

        // 2. Deploy CollateralVault
        CollateralVault collateralVault = new CollateralVault(
            stableTokenAddress,
            msg.sender
        );
        collateralVaultAddress = address(collateralVault);

        // 3. Deploy LoanManager
        LoanManager loanManager = new LoanManager(
            stableTokenAddress,
            collateralVaultAddress
        );
        loanManagerAddress = address(loanManager);

        // 4. Set LoanManager address di CollateralVault
        collateralVault.setLoanManager(loanManagerAddress);

        // 5. Grant MINTER_ROLE ke LoanManager (Factory punya admin role)
        stableToken.grantRole(stableToken.MINTER_ROLE(), loanManagerAddress);

        // 6. Transfer ownership ke user dan renounce factory admin
        stableToken.grantRole(stableToken.DEFAULT_ADMIN_ROLE(), msg.sender);
        stableToken.renounceRole(
            stableToken.DEFAULT_ADMIN_ROLE(),
            address(this)
        );

        // 7. Simpan addresses
        deployedSystems[msg.sender] = DeployedContracts({
            stableToken: stableTokenAddress,
            collateralVault: collateralVaultAddress,
            loanManager: loanManagerAddress
        });

        emit SystemDeployed(
            stableTokenAddress,
            collateralVaultAddress,
            loanManagerAddress,
            msg.sender
        );

        return (stableTokenAddress, collateralVaultAddress, loanManagerAddress);
    }

    function getDeployedSystem(
        address owner
    )
        external
        view
        returns (
            address stableToken,
            address collateralVault,
            address loanManager
        )
    {
        DeployedContracts memory system = deployedSystems[owner];
        return (system.stableToken, system.collateralVault, system.loanManager);
    }
}
