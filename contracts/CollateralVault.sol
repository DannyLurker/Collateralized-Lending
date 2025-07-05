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
        require(
            userCollateral[user] >= _ether,
            "Refund amount exceeds allowable limit."
        );
        uint256 userCollateralInfo = userCollateral[user] - _ether;
        (bool sent, ) = user.call{value: _ether}("");
        require(sent, "Failed to send Ether");
        emit UserWithdrawCollateral(user, userCollateralInfo, _ether);
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
        // uint256 ETHtoUSDConvertionRate = getETHtoUSD(1e18);
        uint256 ETHtoUSDConvertionRateTest = (1e18 * (3000 * 1e8)) / 1e26;
        uint256 userCollateralValueinUSD = (userCollateral[userAddress] *
            ETHtoUSDConvertionRateTest) / 1e18;
        uint256 userCSBToken = stableToken.balanceOf(userAddress) / 1e18;
        uint256 healthFactor = userCollateralValueinUSD / userCSBToken;
        return healthFactor;
    }

    function liquidation(address userAddress) public onlyLoanManager {
        if (getHealthFactor(userAddress) > 7 * 1e17) {
            revert HealthFactorStillSafe(userAddress);
        }

        decreaseUserCollateral(userAddress, userCollateral[userAddress]);
        emit Liquidation(userAddress, userCollateral[userAddress]);
    }
}
