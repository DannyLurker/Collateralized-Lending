// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./StableToken.sol";
import "./LoanManager.sol";

contract CollateralVault {
    AggregatorV3Interface internal priceFeed;
    StableToken public stableToken;
    LoanManager public loanManager;
    address public ownerAddress;
    address public loanManagerAddress;

    // Dalam bentuk Ether
    mapping(address => uint256) public userCollateral;

    constructor(address stableTokenCA, address _ownerAddress) {
        // ETH/USD
        priceFeed = AggregatorV3Interface(
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        );

        // Type Casting : StableToken(stableTokenCA)
        stableToken = StableToken(stableTokenCA);

        ownerAddress = _ownerAddress;
    }

    event UserAddCollateral(address indexed account, uint256 amount);
    event UserWithdrawCollateral(
        address indexed account,
        uint256 beforeWithdrawCollateralAmount,
        uint256 withdrawAmount
    );
    event Liquidation(address indexed account, uint256 amount);

    error Unauthorized(address account);
    error HealthFactorStillSafe(address account);
    error LoanManagerNotSet();

    modifier ownerOnly() {
        if (msg.sender != ownerAddress) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    modifier onlyLoanManager() {
        if (loanManagerAddress == address(0)) {
            revert LoanManagerNotSet();
        }
        if (msg.sender != loanManagerAddress) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    function setLoanManager(address _loanManager) external {
        loanManagerAddress = _loanManager;
    }

    function getETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        // price is 8 decimals, ethAmount is 18 decimals
        return (ethAmount * uint256(price)) / 1e26; // (eth * price) / 1e18 / 1e8
    }

    function addUserCollateral(address user, uint256 _ether) external payable {
        userCollateral[user] += _ether;
        emit UserAddCollateral(user, _ether);
    }

    function withdrawCollateral(address user, uint256 _ether) external {
        uint256 totalEtherUserGet = _ether - (_ether / 30);

        uint256 beforeWithdrawCollateralAmount = userCollateral[msg.sender];

        // IMPORTANT CHECK: Ensure user has enough collateral to cover the *total deduction*
        // This is the primary fix for the panic code 0x11 in this context.
        require(
            userCollateral[user] >= _ether,
            "Collateral: Insufficient collateral to cover withdrawal and fee."
        );

        // Update user's collateral *after* the deduction
        userCollateral[user] -= _ether;

        // Send the requested _ether to the user
        (bool sent, ) = user.call{value: totalEtherUserGet}("");
        require(sent, "Collateral: Failed to send Ether");

        // Emit event with the correct values
        // userCollateralInfo (old name) is now `beforeWithdrawCollateralAmount`
        // _ether (old name) is now `amountToSendToUser`
        emit UserWithdrawCollateral(
            user,
            beforeWithdrawCollateralAmount,
            totalEtherUserGet
        );
    }
    function decreaseUserCollateral(
        address user,
        uint256 _ether
    ) public onlyLoanManager {
        require(
            userCollateral[user] >= _ether,
            "Refund amount exceeds allowable limit."
        );
        userCollateral[user] -= _ether;
    }

    function getHealthFactor(
        address userAddress
    ) public view returns (uint256) {
        uint256 userCSBToken = stableToken.balanceOf(userAddress);

        // If user has no debt, return a very high health factor (safe)
        if (userCSBToken == 0) {
            return type(uint256).max;
        }

        uint256 collateralValueToUSD = getETHtoUSD(userCollateral[userAddress]);

        // Convert CSB tokens to USD value (CSB tokens are 18 decimals, 1 CSB = $1)
        uint256 debtValueUSD = userCSBToken / 1e18;

        // Health factor = (collateral value / debt value) * 1e18 for precision
        // A health factor of 1e18 means 100% collateralization
        uint256 healthFactor = (collateralValueToUSD * 1e18) / debtValueUSD;

        return healthFactor;
    }

    function liquidation(address userAddress) public onlyLoanManager {
        uint256 healthFactor = getHealthFactor(userAddress);

        if (healthFactor >= 9e17) {
            revert HealthFactorStillSafe(userAddress);
        }

        uint256 userCollateralAmount = userCollateral[userAddress];
        decreaseUserCollateral(userAddress, userCollateralAmount);
        emit Liquidation(userAddress, userCollateralAmount);
    }
}
