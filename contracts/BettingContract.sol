pragma solidity ^0.8.6;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./MockUSDC.sol";

contract BettingContract is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    enum Side { LONG, SHORT }
    enum Status { PENDING, ACTIVE, CLOSED }
    struct Bet {
        uint amount;
        uint expirationTime;
        uint closingTime;
        address bettorA;
        address bettorB;
        address winner; // The winner of the bet
        Side side;
        uint openPrice;
        uint closePrice;
        Status status;
    }

    MockUSDC public usdc;
    mapping (uint => Bet) public bets;
    uint public currentBetId;
    uint public btcPrice;
    
    constructor(address _usdcAddress, address _oracleAddress) {
        usdc = MockUSDC(_usdcAddress);
        _setupRole(ORACLE_ROLE, _oracleAddress);
    }
    
    function setPrice(uint _btcPrice) external {
        require(hasRole(ORACLE_ROLE, msg.sender), "Caller is not an oracle");
        btcPrice = _btcPrice;
    }

    function createBet(uint _amount, uint _expirationTime, uint _closingTime, Side _side) external {
        usdc.transferFrom(msg.sender, address(this), _amount);
        bets[currentBetId] = Bet(_amount, _expirationTime, _closingTime, msg.sender, address(0), address(0), _side, btcPrice, 0, Status.PENDING);
        currentBetId++;
    }

    function joinBet(uint _betId) external {
        Bet storage bet = bets[_betId];
        require(bet.status == Status.PENDING, "Bet is not pending");
        require(block.timestamp < bet.expirationTime, "Bet has expired");
        usdc.transferFrom(msg.sender, address(this), bet.amount);
        bet.bettorB = msg.sender;
        bet.openPrice = btcPrice;
        bet.status = Status.ACTIVE;
    }

    function closeAndWithdraw(uint _betId) external {
        Bet storage bet = bets[_betId];
        require(block.timestamp > bet.closingTime, "Bet is not yet closeable");

        bet.closePrice = btcPrice;
        bet.status = Status.CLOSED;

        if (bet.openPrice == bet.closePrice) { // If the open price equals the close price, it's a draw
            bet.winner = address(0); // Set winner as address(0) to represent a draw
        } else {
            bool aWins = (bet.side == Side.LONG && bet.closePrice > bet.openPrice) || (bet.side == Side.SHORT && bet.closePrice < bet.openPrice);
            bet.winner = aWins ? bet.bettorA : bet.bettorB; // Set the winner of the bet
        }

        require(bet.status == Status.CLOSED, "Bet is not closed");
        require(bet.winner != address(0), "No winner"); // Ensure there is a winner

        if (bet.amount > 0) {
            uint winnings = bet.amount * 2;
            bet.amount = 0;
            if (msg.sender == bet.bettorA || msg.sender == bet.bettorB) {
                usdc.transfer(bet.winner, winnings); // Send the winnings to the winner
            } else {
                uint fee = winnings * 2 / 100; // Calculate the fee (2% of the total winnings)
                usdc.transfer(msg.sender, fee); // Send the fee to the caller
                usdc.transfer(bet.winner, winnings - fee); // Send the remaining winnings to the winner
            }
        }
    }
}