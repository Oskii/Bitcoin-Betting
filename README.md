# Ethereum Betting Contract
## Description

This project is a simple Ethereum betting contract developed using Solidity, Hardhat, and OpenZeppelin. The contract lets users place bets on whether the price of Bitcoin will go up or down within a specific time frame.

## Dependencies

Node.js (14 or newer)

Hardhat (`npm install --save-dev hardhat`)

OpenZeppelin Contracts (`npm install @openzeppelin/contracts`)

Nomic Foundation Hardhat Toolbox (`npm install --save-dev @nomicfoundation/hardhat-toolbox`)

Dot Env (`npm install --save-dev dotenv`)

## Installation
To install the dependencies, you can run:

```bash
npm install
```

To compile the contracts, you can run:
```bash
npx hardhat compile
```
## Testing

To test the contracts, you can run:
```bash
npx hardhat test
```

## Simulating the usage of the contracts

First run a local hardhat node in one terminal. (Make sure you are in the folder for this project and have already completed the installation steps)
```bash
npx hardhat node
```

Then, once it is done spinning up you can run a simulated bet, by using the Hardhat command line in a second terminal:

```bash
npx hardhat run scripts/deploy.js
```

## Database Design
I have chosen to propose using a MySQL database to store betting data (Postgres would also be fine). Here's the schema:

```sql
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ethereum_address` VARCHAR(42) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `bets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `amount` DECIMAL(18,8) NOT NULL,
  `expiration_time` BIGINT NOT NULL,
  `closing_time` BIGINT NOT NULL,
  `bettor_a_id` INT NOT NULL,
  `bettor_b_id` INT NULL,
  `winner_id` INT NULL,
  `side` ENUM('LONG', 'SHORT') NOT NULL,
  `open_price` DECIMAL(18,8) NOT NULL,
  `close_price` DECIMAL(18,8) NULL,
  `status` ENUM('PENDING', 'ACTIVE', 'CLOSED') NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`bettor_a_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`bettor_b_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`winner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB;

```

## Some useful queries for the proposed database

Get all bets of a specific user:
```sql
SELECT bets.* 
FROM bets 
JOIN users ON (bettor_a_id = users.id OR bettor_b_id = users.id)
WHERE users.ethereum_address = '<ethereum_address>';
```

Get all active bets:
```sql
SELECT * 
FROM bets 
WHERE status = 'ACTIVE';
```
Get all closed bets where a specific user was the winner:
```sql
SELECT bets.* 
FROM bets 
JOIN users ON bets.winner_id = users.id
WHERE users.ethereum_address = '<ethereum_address>' 
AND status = 'CLOSED';
```
## Improvements and Further Ideas

### Improvement 1 - Fully Decentralized Oracle.

Eliminating the need for an oracle would be beneficial. I have achieved this by directly obtaining the `Wrapped Bitcoin` to `USDC` price from `UniSwapV2`.

You can see the implementation in `contracts/Oracle.sol`

### How it works

The Oracle contract is a smart contract that interacts with a Uniswap V2 Pair to provide price updates for a given asset pair (in this case, Bitcoin to USDC). This contract is designed to provide decentralized price feeds to the BettingContract.

The Oracle contract keeps track of the Uniswap V2 Pair address and the current price. The price is updated by calling the updatePrice() function, which fetches the current reserves of the assets from the Uniswap V2 Pair and calculates the price.

The contract also contains a reference to the BettingContract and a function updateBtcPriceInBettingContract(), which anyone can call to update the Bitcoin price in the BettingContract. This function first updates the current price using the updatePrice() function, and then calls the setPrice() function of the BettingContract to update the Bitcoin price there.

The Oracle contract requires that it has the ORACLE_ROLE in the BettingContract, to be able to call the setPrice() function.

### Improvement 2 - Any token vs Any token betting.

The Betting contract and the Oracle contract currently only accept bets on the price of Bitcoin against USDC, because the underlying contracts are only set up to handle this specific trading pair.

If you wanted to modify these contracts to accept bets on any trading pairs (for instance, USDT vs GHST, or WETH vs MATIC), you would have to make a few changes:

Parameterize the Oracle Contract: The Oracle contract currently has hardcoded references to Bitcoin and USDC. To generalize it for any trading pair, these would need to be made into constructor parameters. Then when deploying the Oracle contract, you would pass the address of the specific Uniswap V2 Pair contract that handles the desired trading pair.

Parameterize the Betting Contract: The Betting contract also currently has hardcoded references to USDC. To allow it to handle any type of token, these references would need to be replaced with a variable that can be set upon deployment or upon creating a bet. This might involve having an additional parameter in the constructor for the token address and adjusting the logic in the functions to use the ERC20 interface instead of the specific USDC contract.

Change the Oracle Updating Mechanism: The Oracle contract is updated manually by calling updatePrice(). In a more general system, you might want to change this to an automatic process, perhaps by having the Oracle contract listen for events emitted by the Uniswap V2 Pair contracts when trades happen.


