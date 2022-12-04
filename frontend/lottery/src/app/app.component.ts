import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Address } from 'cluster';
import { ethers, Wallet } from 'ethers';
import { inherits } from 'util';
import { threadId } from 'worker_threads';
import lotteryJson from '../assets/Lottery.json'
import tokenJson from '../assets/LotteryToken.json'
import { environment } from "../environments/environment";
import { NgxSpinnerService } from "ngx-spinner";


const BET_PRICE = 1;
const BET_FEE = 0.2;
const TOKEN_RATIO = 1;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
  mainMessage : string | undefined;
  wallet: ethers.Wallet | undefined;
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
    this.wallet = _wallet;
    this.lotteryInterface = new ethers.utils.Interface(lotteryJson.abi);

    const lotteryFactory = new ethers.ContractFactory(
      this.lotteryInterface,
      lotteryJson.bytecode,
      this.wallet);

    lotteryFactory.deploy(
      "Lottery",
      "LT0",
      TOKEN_RATIO,
      ethers.utils.parseEther(BET_PRICE.toFixed(18)),
      ethers.utils.parseEther(BET_FEE.toFixed(18))
    ).then((contract) => {

      this.mainMessage = "Please Wait : retreiving Token address";
      this.lotteryAddr = contract.address;

      contract["paymentToken"]().then((address:string) => {

        this.mainMessage = "";
        this.spinner.hide();

        this.tokenAddr = address;
        this.tokenInterface = new ethers.utils.Interface(tokenJson.abi);

        const lotteryFactory = new ethers.ContractFactory(
          this.tokenInterface,
          tokenJson.bytecode);
        this.tokenContract = lotteryFactory.attach(this.tokenAddr);
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
    this.init(new Wallet(environment.PRIVATE_KEY).connect(this.provider));
  }

  checkState() {
/*
    const state = await contract.betsOpen();
    console.log(`The lottery is ${state ? "open" : "closed"}\n`);
    if (!state) return;
    const currentBlock = await ethers.provider.getBlock("latest");
    const currentBlockDate = new Date(currentBlock.timestamp * 1000);
    const closingTime = await contract.betsClosingTime();
    const closingTimeDate = new Date(closingTime.toNumber() * 1000);
    console.log(
      `The last block was mined at ${currentBlockDate.toLocaleDateString()} : ${currentBlockDate.toLocaleTimeString()}\n`
    );
    console.log(
      `lottery should close at ${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}\n`
    );
    */
     }
  
}
