pragma solidity ^0.8.6;

import "./BettingContract.sol";

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract Oracle {
    address public uniswapV2PairAddress;
    uint256 public currentPrice;
    BettingContract public bettingContract; // Reference to the BettingContract

    constructor(address _uniswapV2PairAddress, address _bettingContractAddress) {
        uniswapV2PairAddress = _uniswapV2PairAddress;
        bettingContract = BettingContract(_bettingContractAddress); // Initialize BettingContract
    }

    function updatePrice() public {
        (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(uniswapV2PairAddress).getReserves();
        currentPrice = (reserve1 * 1e12) / reserve0; // Adjusted for 6 decimal places of USDC
    }

    function updateBtcPriceInBettingContract() external {
        updatePrice();
        bettingContract.setPrice(currentPrice);
    }

    function getCurrentPrice() external view returns (uint256) {
        return currentPrice;
    }
}