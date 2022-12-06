import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Address } from 'cluster';
import { BigNumber, ContractReceipt, ethers, Transaction, Wallet } from 'ethers';
import { inherits } from 'util';
import { threadId } from 'worker_threads';
import lotteryJson from '../assets/Lottery.json'
import tokenJson from '../assets/LotteryToken.json'
import { environment } from "../environments/environment";
import { NgxSpinnerService } from "ngx-spinner";
import { Block } from '@ethersproject/providers';
import { setDefaultResultOrder } from 'dns';



const BET_PRICE = .5;
const BET_FEE = 0.01;
const TOKEN_RATIO = 10;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  mainMessage: string | undefined;
  ownerWallet: ethers.Wallet | undefined;
  provider: ethers.providers.Provider;
  etherBalance: number | undefined;
  tokenBalance: number | undefined;
  votePower: number | undefined;
  tokenContract: ethers.Contract | undefined;
  tokenAddr: string | undefined;
  tokenInterface: ethers.utils.Interface | undefined;
  lotteryContract: ethers.Contract | undefined;
  lotteryAddr: string | undefined;
  lotteryInterface: ethers.utils.Interface | undefined;
  accounts: Wallet[] | undefined;
  walletAddr0: string | undefined;
  walletAddr1: string | undefined;
  walletAddr2: string | undefined;
  etherBalance0: Number | undefined;
  etherBalance1: Number | undefined;
  etherBalance2: Number | undefined;
  tokenBalance0: Number | undefined;
  tokenBalance1: Number | undefined;
  tokenBalance2: Number | undefined;

  ngOnInit() {
    /** spinner starts on init */
    this.spinner.show();

    setTimeout(() => {
      /** spinner ends after 5 seconds */
      this.spinner.hide();
    }, 5000);
  }
  constructor(private http: HttpClient, private spinner: NgxSpinnerService) {
    this.provider = new ethers.providers.AlchemyProvider("goerli", environment.ALCHEMY_API_KEY);
    console.log(this.provider);
  }

  /**
   * This initializes this.wallet, connects it to the token contract
   * and retrieves some informations
   */
  init(_wallet: ethers.Wallet) {

    this.mainMessage = "Please Wait : deploying";
    this.spinner.show();
    this.ownerWallet = _wallet;
    this.lotteryInterface = new ethers.utils.Interface(lotteryJson.abi);

    const lotteryFactory = new ethers.ContractFactory(
      this.lotteryInterface,
      lotteryJson.bytecode,
      this.ownerWallet);

    lotteryFactory.deploy(
      "Lottery",
      "LT0",
      TOKEN_RATIO,
      ethers.utils.parseEther(BET_PRICE.toFixed(18)),
      ethers.utils.parseEther(BET_FEE.toFixed(18))
    ).then((contract) => {

      this.mainMessage = "Please Wait : retreiving Token address";
      this.lotteryContract = contract;
      this.lotteryAddr = contract.address;

      console.log(`[init] : lotteryContract =  ${this.lotteryContract}`);

      contract["paymentToken"]().then((address: string) => {

        this.mainMessage = "";
        this.spinner.hide();

        this.tokenAddr = address;
        this.tokenInterface = new ethers.utils.Interface(tokenJson.abi);

        const lotteryFactory = new ethers.ContractFactory(
          this.tokenInterface,
          tokenJson.bytecode);
        this.tokenContract = lotteryFactory.attach(this.tokenAddr).connect(this.provider);

        this.openBets("180"); // 3mn
      })
    });
  }

  /**
   * This creates a new random wallet
   */
  createWallet() {

    this.init(ethers.Wallet.createRandom().connect(this.provider));
  }

  /**
   * This imports a wallet with environment.PRIVATE_KEY
   */

  importWallet() {
    this.accounts = new Array(3);
    this.accounts[0] = new Wallet(environment.PRIVATE_KEY1).connect(this.provider);
    this.accounts[1] = new Wallet(environment.PRIVATE_KEY2).connect(this.provider);
    this.accounts[2] = new Wallet(environment.PRIVATE_KEY3).connect(this.provider);
    this.walletAddr0 = this.accounts[0].address;
    this.walletAddr1 = this.accounts[1].address;
    this.walletAddr2 = this.accounts[2].address;
    this.init(new Wallet(environment.PRIVATE_KEY).connect(this.provider));
  }

  async checkState() {
    if (!this.lotteryContract) {
      this.mainMessage = "/!\\ lotteryContract is null /!\\";
      return;
    }

    console.log("[checkState]");
    this.mainMessage = "Checking state";

    this.lotteryContract["betsOpen"]().then((state: boolean) => {

      console.log(`[checkState] : The lottery is ${state ? "open" : "closed"}`);
      this.mainMessage = `The lottery is ${state ? "open" : "closed"}`;

      if (!state)
        return;

      console.log("[checkState] : get last block");
      this.provider.getBlock("latest").then((currentBlock: Block) => {

        const currentBlockDate = new Date(currentBlock.timestamp * 1000);

        if (!this.lotteryContract)
          return;

        this.lotteryContract["betsClosingTime"]().then((closingTime: BigNumber) => {

          const closingTimeDate = new Date(closingTime.toNumber() * 1000);
          console.log(
            `[checkState] : The last block was mined at ${currentBlockDate.toLocaleDateString()} : ${currentBlockDate.toLocaleTimeString()}\n`
          );
          console.log(
            `[checkState] : lottery should close at ${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}\n`
          );
          this.mainMessage = `The lottery should close at ${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}`;
        })
      })
    })

  }

  openBets(duration: string) {
    if (!this.lotteryContract) {
      this.mainMessage = "/!\\ lotteryContract is null /!\\";
      return;
    }

    console.log("[openBets] get last block");
    this.mainMessage = "Opening bets getting last block";

    this.provider.getBlock("latest").then((currentBlock: Block) => {
      if (!this.lotteryContract)
        return;

      console.log("[openBets] : opening Bets");
      this.lotteryContract["openBets"](currentBlock.timestamp + Number(duration)).then((tx: { wait: () => Promise<any>; }) => {
        console.log(`[openBets] : ${tx}`);
        tx.wait().then((receipt) => {
          console.log(`[openBets] : ${receipt.transactionHash}`);
          this.mainMessage = "Bets opened";
          this.displayBalancesAndBuyTokens();
        })
      })
    })
  }


  displayBalancesAndBuyTokens() {
    if (!this.accounts)
      return;

    this.mainMessage = "Retreiving balance";

    for (let i = 0; i < this.accounts.length; i++) {
      this.provider.getBalance(
        this.accounts[i].address
      ).then((balance: BigNumber) => {
        if (!this.accounts)
          return;
        const balanceEthers = ethers.utils.formatEther(balance);
        switch (i) {
          case 0: this.etherBalance0 = new Number(balanceEthers); break;
          case 1: this.etherBalance1 = new Number(balanceEthers); break;
          case 2: this.etherBalance2 = new Number(balanceEthers); break;
        }
        console.log(`[displayBalancesAndBuyTokens] : Balance of wallet ${this.accounts[Number(i)].address} = ${balanceEthers}`);
        let amount = i + 1;
        this.buyAndDisplayTokens(i.toString(), amount.toString());
      })
    }
  }


  buyAndDisplayTokens(index: string, amount: string) {
    if (!this.lotteryContract || !this.accounts) {
      this.mainMessage = "/!\\ lotteryContract is null /!\\";
      return;
    }

    console.log(`[buyAndDisplayTokens] : ${this.accounts[Number(index)].address} is buying ${amount} tokens`);
    this.mainMessage = `${this.accounts[Number(index)].address} is buying ${amount} tokens`;

    let value = ethers.utils.parseEther(amount).div(TOKEN_RATIO);
    console.log(`[buyAndDisplayTokens] : value = ${value}`);

    this.lotteryContract.connect(this.accounts[Number(index)])["purchaseTokens"]({
      value: ethers.utils.parseEther(amount).div(TOKEN_RATIO),
    }).then((tx: { wait: () => Promise<any>; }) => {
      console.log(`[buyAndDisplayTokens] : waiting receipt`);
      tx.wait().then((receipt) => {
        console.log(`[buyAndDisplayTokens] : Tokens buy Tx hash (${receipt.transactionHash})\n`);
        this.displayTokenBalance(index);
      })
    })
  }

  displayTokenBalance(index: string) {
    if (!this.tokenContract || !this.accounts)
      return;

    console.log(`[displayTokenBalance] : Retreiving token balance for ${this.accounts[Number(index)].address}`);
    this.mainMessage = `Retreiving token balance for ${this.accounts[Number(index)].address}`;

    console.log(`[displayTokenBalance] : tokenContrat ${this.tokenContract}`);
    console.log(`[displayTokenBalance] : this.accounts[${Number(index)}].address ${this.accounts[Number(index)].address}`);
    this.tokenContract["balanceOf"](this.accounts[Number(index)].address).then((balanceBN: BigNumber) => {

      const balance = ethers.utils.formatEther(balanceBN);
      console.log(`[displayTokenBalance] : balance =  ${balance}`);

      if (!this.accounts)
        return;

      console.log(`[displayTokenBalance] : The account of address ${this.accounts[Number(index)].address} has ${balance} LT0\n`);
      switch (index) {
        case "0": this.tokenBalance0 = new Number(balance); break;
        case "1": this.tokenBalance1 = new Number(balance); break;
        case "2": this.tokenBalance2 = new Number(balance); break;
      }

      console.log(`[displayTokenBalance] : Token balance of wallet ${this.accounts[Number(index)].address} = ${balance}`);

      this.checkState();
    })

  }

  bet(index: string, amount: string) {
    if (!this.tokenContract || !this.lotteryContract || !this.accounts)
      return;

    this.mainMessage = `Bet approving ${this.accounts[Number(index)].address}, amount : ${amount}`;
    console.log(`[bet] approving ${this.accounts[Number(index)].address}, amount : ${amount}`);

    this.tokenContract
      .connect(this.accounts[Number(index)])
    ["approve"](this.lotteryContract.address, ethers.constants.MaxUint256)
      .then((approveTx: { wait: () => Promise<any>; }) => {
        if (!this.tokenContract || !this.lotteryContract || !this.accounts)
          return;

        console.log(`[bet] approved`);

        approveTx.wait().then(() => {
          if (!this.tokenContract || !this.lotteryContract || !this.accounts)
            return;

          console.log(`[bet] betting`);

          this.lotteryContract.connect(this.accounts[Number(index)])["betMany"](amount).then((betTx: { wait: () => Promise<any>; }) => {
            betTx.wait().then((receipt) => {
              this.displayTokenBalance(index);
              console.log(`Bets placed Tx hash (${receipt.transactionHash})\n`);
              this.mainMessage = `Bets Tx hash (${receipt.transactionHash})\n`;
            })
          })
        })
      })
  }


  closeLottery() {
    if (!this.lotteryContract)
      return;

    console.log(`[closeLottery] Closing lottery`);
    this.mainMessage = `Closing lottery`;

    this.lotteryContract["closeLottery"]().then((closeTx: { wait: () => Promise<any>; }) => {
      closeTx.wait().then((receipt) => {
        console.log(`[closeLottery] Lottery closed Tx hash (${receipt.transactionHash})\n`);
        this.mainMessage = `Lottery closed Tx hash (${receipt.transactionHash})`;
      })
    })
  }

  displayPrize(index: string) {
    if (!this.lotteryContract || !this.accounts)
      return;

    console.log(`[displayPrize] displaying prize`);
    this.mainMessage = "Displaying prize";

    this.lotteryContract["prize"](this.accounts[Number(index)].address).then((prizeBN: BigNumber) => {
      const prize = ethers.utils.formatEther(prizeBN);

      if (!this.accounts)
        return;

      this.mainMessage = `[displayPrize] The account of address ${this.accounts[Number(index)].address} has earned a prize of ${prize} Tokens\n`;

      console.log(
        `[displayPrize] The account of address ${this.accounts[Number(index)].address
        } has earned a prize of ${prize} Tokens\n`
      );
    })
  }

  claimPrize(index: string, amount: string) {
    if (!this.lotteryContract || !this.accounts)
      return;

    console.log(`[claimPrize] claiming prize`);
    this.mainMessage = "Claiming prize";

    this.lotteryContract.connect(this.accounts[Number(index)])
    ["prizeWithdraw"](ethers.utils.parseEther(amount)).then((claimTx: { wait: () => Promise<any>; }) => {
      claimTx.wait().then((receipt) => {
        this.mainMessage = `Prize claimed Tx hash (${receipt.transactionHash})`;
        console.log(`Prize claimed Tx hash (${receipt.transactionHash})`);
      })
  })
}
}
