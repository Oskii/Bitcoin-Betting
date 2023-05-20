const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  // Fetch accounts
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];
  const bettorA = accounts[1];
  const bettorB = accounts[2];
  const oracle = accounts[3];
  const now = parseInt(Date.now() / 1000);
  var joiningWindow = 5;
  var expiryTime = 5;

  console.log(`👤 Bet Closer Bot Address: ${deployer.address}`);
  console.log(`👤 Bettor A Address: ${bettorA.address}`);
  console.log(`👤 Bettor B Address: ${bettorB.address}`);
  console.log(`👤 Bitcoin Price Oracle Address: ${oracle.address}`);

  // Deploy MockUSDC
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(ethers.utils.parseUnits("0", 6)); // 10 million USDC with 6 decimals
  await usdc.deployed();
  console.log("📝 USDC token deployed to:", usdc.address);

  // Deploy BettingContract
  const BettingContract = await hre.ethers.getContractFactory("BettingContract");
  const bettingContract = await BettingContract.deploy(usdc.address, oracle.address);
  await bettingContract.deployed();
  console.log("📝 BettingContract deployed to:", bettingContract.address);

  // Oracle sets new random BTC price
  var newPrice = Math.floor(Math.random() * (75000 - 25000 + 1)) + 25000; // Random price between 25k and 75k
  await bettingContract.connect(oracle).setPrice(newPrice * 10**6); // Setting new random BTC price
  console.log(`₿ Oracle has set the new BTC price to ${newPrice} USDC`);

  const mintAmount = 100000;
  
  // Mint USDC for bettorA and bettorB
  await usdc.mint(bettorA.address, ethers.utils.parseUnits(mintAmount.toString(), 6)); // 100k USDC for bettorA
  await usdc.mint(bettorB.address, ethers.utils.parseUnits(mintAmount.toString(), 6)); // 100k USDC for bettorB
  console.log(`💵 Minted ${mintAmount} USDC for bettorA and bettorB...`);

    // Allow bettingContract to move USDC on behalf of bettorA and bettorB
  const betAmount = ethers.utils.parseUnits("500", 6); // 500 USDC
  await usdc.connect(bettorA).approve(bettingContract.address, betAmount);
  await usdc.connect(bettorB).approve(bettingContract.address, betAmount);
  console.log("🤝 Approval granted to bettingContract to move USDC for bettorA and bettorB");

  // BettorA opens a bet
  await bettingContract.connect(bettorA).createBet(betAmount, now + joiningWindow, now + expiryTime -1, 0);
  console.log("📈 bettorA has opened a bet - Going long");

  // BettorB joins the bet
  await bettingContract.connect(bettorB).joinBet(0);
  console.log("📉 bettorB has joined the bet - Going short");

  console.log("🕒 Waiting for the bet time window to elapse");

  const closingTime = now + joiningWindow + expiryTime; // Finishing time of the bet
  await waitForBlockTimestamp(closingTime);

  // Oracle sets new random BTC price
  newPrice = Math.floor(Math.random() * (75000 - 25000 + 1)) + 25000; // Random price between 25k and 75k
  await bettingContract.connect(oracle).setPrice(newPrice * 10**6); // Setting new random BTC price
  console.log(`₿ Oracle has set the new BTC price to ${newPrice} USDC`);

  // Close the bet and determine the winner
  console.log("👨‍⚖️ Closing the bet and determining the winner...");
  await bettingContract.closeAndWithdraw(0);

  // Fetch the winner of the bet
  const betInfo = await bettingContract.bets(0);
  const winner = betInfo.winner;

  if (winner == bettorA.address) {
    console.log(`🥳 bettorA is the winner of the bet with address: ${winner}`);
  } else if (winner == bettorB.address) {
    console.log(`🥳 bettorB is the winner of the bet with address: ${winner}`);
  } else {
    console.log(`😐 The bet ended in a draw. There's no winner.`);
  }

  // Get the final balances of bettorA and bettorB
    const bettorABalance = await usdc.balanceOf(bettorA.address);
    const bettorBBalance = await usdc.balanceOf(bettorB.address);
    const botBalance = await usdc.balanceOf(deployer.address);

    console.log(`💰 Final balance of bettorA: ${ethers.utils.formatUnits(bettorABalance, 6)} USDC`);
    console.log(`💰 Final balance of bettorB: ${ethers.utils.formatUnits(bettorBBalance, 6)} USDC`);
    console.log(`💰 Final balance of Bot: ${ethers.utils.formatUnits(botBalance, 6)} USDC`);
}

async function waitForBlockTimestamp(timestamp) {
    while (true) {
      await hre.network.provider.send("evm_mine")  // Mine a new block
      const block = await ethers.provider.getBlock("latest");
      const currentTimestamp = block.timestamp;
      if (currentTimestamp > timestamp) {
        break;
      }
      const remainingTime = timestamp - currentTimestamp;
      console.log(`🕒 Waiting for ${remainingTime} seconds... current time ${currentTimestamp} expiry time ${timestamp}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});

