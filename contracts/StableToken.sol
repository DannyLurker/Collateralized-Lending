// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract StableToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    address public ownerAddress;

    event Mint(address indexed to, uint256 amount);
    event Pause(address account);
    event Unpause(address account);
    event TranferToken(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    constructor(address initialOwner) ERC20("ColStable", "CSB") {
        ownerAddress = initialOwner;
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
        _grantRole(PAUSER_ROLE, initialOwner);

        uint256 initialSupply = 1_000_000_000 * 10 ** decimals();
        _mint(address(this), initialSupply);
    }

    function mint(address to, uint256 amount) public {
        require(
            hasRole(MINTER_ROLE, msg.sender) ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "No minter or admin role"
        );
        emit Mint(to, amount);
        _mint(to, amount);
    }

    function pause() public {
        require(
            hasRole(PAUSER_ROLE, msg.sender) ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "No pauser or admin role"
        );
        emit Pause(msg.sender);
        _pause();
    }

    function unpause() public {
        require(
            hasRole(PAUSER_ROLE, msg.sender) ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "No pauser or admin role"
        );
        emit Unpause(msg.sender);
        _unpause();
    }

    function tokenTransferFrom(
        address from,
        address to,
        uint256 value
    ) external {
        transferFrom(from, to, value);
        emit TranferToken(from, to, value);
    }

    function approveLoanManagerUnlimited(address loanManager) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "No admin role");
        _approve(address(this), loanManager, type(uint256).max);
    }

    // ADD: Special function for contract to approve itself for transfers
    function approveContractTransfer(address spender, uint256 amount) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "No admin role");
        _approve(address(this), spender, amount);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, ERC20Pausable) {
        super._update(from, to, amount);
    }
}
