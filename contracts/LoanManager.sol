// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {StableToken} from "./StableToken.sol";
import {CollateralVault} from "./CollateralVault.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract LoanManager {
    StableToken public stableToken;
    CollateralVault public collateralVault;
    AggregatorV3Interface internal priceFeed;
    address private stableTokenAddress;
    address private collateralVaultAddress;
    address private loanManagerAddress;

    event TransferTokenCSB(
        address indexed from,
        address indexed to,
        uint256 value
    );
    event DepositCollateral(
        address indexed from,
        address indexed to,
        uint256 value
    );
    event DecreaseCollateral(address indexed account, uint256 ethereum);

    error InsufficientBalance(address acoount);
    error InsufficientSupply(address stableTokenAddress);

    modifier onlyUser() {
        require(msg.sender != loanManagerAddress, "Only user can call this");
        _;
    }

    //Kegunaan dari underscore : Untuk membedakan antara parameter fungsi (misal: _stableTokenAddress) dan variabel state (misal: stableTokenAddress) di dalam kontrak.
    constructor(address _stableTokenAddress, address _collateralVaultAddress) {
        loanManagerAddress = msg.sender;
        stableToken = StableToken(_stableTokenAddress);
        collateralVault = CollateralVault(_collateralVaultAddress);
        stableTokenAddress = address(stableToken);
        collateralVaultAddress = address(collateralVault);
        priceFeed = AggregatorV3Interface(
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        );
    }

    function getETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        // price is 8 decimals, ethAmount is 18 decimals
        return (ethAmount * uint256(price)) / 1e26; // (eth * price) / 1e18 / 1e8
    }

    function depositCollateral() external payable onlyUser {
        if (msg.value <= 0) {
            revert InsufficientBalance(msg.sender);
        }

        // uint256 ETHtoUSDConvertionRate = getETHtoUSD(msg.value);
        uint256 ETHtoUSDConvertionRateTest = (msg.value * (3000 * 1e8)) / 1e26;
        uint256 CBSTokenAmount = ETHtoUSDConvertionRateTest * 1e18;

        if (stableToken.totalSupply() <= CBSTokenAmount) {
            revert InsufficientSupply(stableTokenAddress);
        }

        collateralVault.addUserCollateral{value: msg.value}(
            msg.sender,
            msg.value
        );

        // Perlu di approve dulu, jika ingin di gunakan
        stableToken.tokenTransferFrom(
            stableTokenAddress,
            msg.sender,
            CBSTokenAmount
        );

        emit DepositCollateral(msg.sender, collateralVaultAddress, msg.value);
        emit TransferTokenCSB(stableTokenAddress, msg.sender, CBSTokenAmount);
    }

    function unlockCollateral(uint256 csbToken) external payable onlyUser {
        // uint256 ETHtoUSDConvertionRate = getETHtoUSD(1e18);
        uint256 ETHtoUSDConvertionRateTest = (1e18 * (3000 * 1e8)) / 1e26;
        uint256 CSBTokenToETH = ((csbToken / 1e18) /
            ETHtoUSDConvertionRateTest) * 1e18;

        if (stableToken.balanceOf(msg.sender) < csbToken) {
            revert InsufficientBalance(msg.sender);
        }

        stableToken.transferFrom(msg.sender, stableTokenAddress, csbToken);
        emit TransferTokenCSB(msg.sender, stableTokenAddress, csbToken);

        collateralVault.withdrawCollateral(msg.sender, CSBTokenToETH);

        collateralVault.decreaseUserCollateral(msg.sender, CSBTokenToETH);
        emit DecreaseCollateral(msg.sender, CSBTokenToETH);
    }
}
