require('dotenv').config();
const ethers = require('ethers');

const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); // use your node provider
const privateKey = process.env.PRIVATE_KEY; // the private key of the account that will call closeBet
const wallet = new ethers.Wallet(privateKey, provider);

const BettingContractABI = [
    // ABI of your BettingContract
];

const BettingContractAddress = 'YOUR_CONTRACT_ADDRESS';

const contract = new ethers.Contract(BettingContractAddress, BettingContractABI, wallet);

async function closeExpiredBets() {
    const currentBetId = (await contract.currentBetId()).toNumber();
    for (let i = 0; i < currentBetId; i++) {
        const bet = await contract.bets(i);
        if (bet.status === '1' && bet.closingTime < Math.floor(Date.now() / 1000)) { // 1 is for active status
            try {
                const tx = await contract.closeBet(i);
                await tx.wait();
                console.log(`Successfully closed bet ${i}`);
            } catch (err) {
                console.error(`Failed to close bet ${i}`, err);
            }
        }
    }
}

setInterval(closeExpiredBets, 60000); // Run the function every minute