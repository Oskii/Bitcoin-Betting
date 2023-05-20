const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BettingContract", function () {
  let BettingContract, MockUSDC, bettingContract, mockUSDC, owner, addr1, addr2, addr3, oracle;

  beforeEach(async function () {
    BettingContract = await ethers.getContractFactory("BettingContract");
    MockUSDC = await ethers.getContractFactory("MockUSDC");
    
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    // Deploy MockUSDC with initial supply of 1000000
    mockUSDC = await MockUSDC.deploy(ethers.utils.parseUnits("1000000", "6"));
    await mockUSDC.deployed();

    // mint some USDC for addr1, addr2, addr3
    await mockUSDC.mint(addr1.address, ethers.utils.parseUnits("5000", "6"));
    await mockUSDC.mint(addr2.address, ethers.utils.parseUnits("5000", "6"));
    await mockUSDC.mint(addr3.address, ethers.utils.parseUnits("5000", "6"));

    // Deploy BettingContract
    bettingContract = await BettingContract.deploy(mockUSDC.address, owner.address); // owner acts as oracle
    await bettingContract.deployed();
  });

  describe("createBet", function () {
    it("Should create a new bet", async function () {
      // addr1 approves the betting contract to transfer USDC on their behalf
      await mockUSDC.connect(addr1).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));

      await bettingContract.connect(addr1).createBet(
        ethers.utils.parseUnits("1000", "6"), 
        Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
        Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours from now
        0 // Side.LONG
      );

      const bet = await bettingContract.bets(0);
      expect(bet.amount).to.equal(ethers.utils.parseUnits("1000", "6"));
      expect(bet.bettorA).to.equal(addr1.address);
      expect(bet.side).to.equal(0); // Side.LONG
    });
  });

  describe("joinBet", function () {
    it("should not allow joining an already active bet", async function () {
      // addr1 and addr2 approve the betting contract to transfer USDC on their behalf
      await mockUSDC.connect(addr1).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
      await mockUSDC.connect(addr2).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
      await mockUSDC.connect(addr3).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));

      // addr1 creates a bet and addr2 joins it
      await bettingContract.connect(addr1).createBet(ethers.utils.parseUnits("1000", "6"), Math.floor(Date.now() / 1000) + 60, Math.floor(Date.now() / 1000) + 60 * 60, 0);
      await bettingContract.connect(addr2).joinBet(0);
      
      // addr3 attempts to join the same bet, which should fail
      await expect(bettingContract.connect(addr3).joinBet(0)).to.be.revertedWith("Bet is not pending");
    });

    it("should not allow joining a bet after its expiration time", async function () {
      // addr1 and addr2 approve the betting contract to transfer USDC on their behalf
      await mockUSDC.connect(addr1).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
      await mockUSDC.connect(addr2).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));

      // addr1 creates a bet with a short expiration time
      await bettingContract.connect(addr1).createBet(ethers.utils.parseUnits("1000", "6"), Math.floor(Date.now() / 1000) + 1, Math.floor(Date.now() / 1000) + 60 * 60, 0);
      
      // Wait for 2 seconds before addr2 tries to join the bet
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // addr2 attempts to join the bet after its expiration time, which should fail
      await expect(bettingContract.connect(addr2).joinBet(0)).to.be.revertedWith("Bet has expired");
    });
  });

  describe("closeAndWithdraw", function () {
    it("should close the bet and transfer winnings to the winner", async function () {
        // addr1 and addr2 approve the betting contract to transfer USDC on their behalf
        await mockUSDC.connect(addr1).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
        await mockUSDC.connect(addr2).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
      
        // addr1 creates a bet and addr2 joins it
        await bettingContract.connect(addr1).createBet(ethers.utils.parseUnits("1000", "6"), Math.floor(Date.now() / 1000) + 60 * 60, Math.floor(Date.now() / 1000) + 60 * 60 * 24, 0);
        await bettingContract.connect(addr2).joinBet(0);
            
        // The owner (oracle) sets a new BTC price
        await bettingContract.connect(owner).setPrice(20000);
            
        // Advance time by 1 day (60 * 60 * 24 seconds)
        await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
        await ethers.provider.send("evm_mine"); // You must mine a new block for the time change to take effect
            
        // addr3 attempts to close the bet and should receive the 2% fee
        await bettingContract.connect(addr3).closeAndWithdraw(0);
            
        const bet = await bettingContract.bets(0);
        expect(bet.status).to.equal(2); // Status.CLOSED
        expect(bet.winner).to.equal(addr1.address); // addr1 should be the winner because they bet on Side.LONG and the price went up
        
        const winnings = await mockUSDC.balanceOf(addr1.address);
        expect(winnings).to.equal(ethers.utils.parseUnits("5960", "6")); // The winnings should be 1960 mUSDC (2% fee was deducted)
      });
    
      it("should not allow closing the bet before the closing time", async function () {

        
        await ethers.provider.send("evm_mine");
        let currentTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        let joinWindow = currentTimestamp + 60 * 60 * 24;
        let expiryWindow = currentTimestamp + 60 * 60 * 24 * 365;
        
        // addr1 and addr2 approve the betting contract to transfer USDC on their behalf
        await mockUSDC.connect(addr1).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
        await mockUSDC.connect(addr2).approve(bettingContract.address, ethers.utils.parseUnits("1000", "6"));
      
        // addr1 creates a bet and addr2 joins it
        await bettingContract.connect(addr1).createBet(ethers.utils.parseUnits("1000", "6"), joinWindow, expiryWindow, 0);
        await bettingContract.connect(addr2).joinBet(0);
        // addr3 attempts to close the bet immediately, which should fail
        await expect(bettingContract.connect(addr3).closeAndWithdraw(0)).to.be.revertedWith("Bet is not yet closeable");
      });
  });
});