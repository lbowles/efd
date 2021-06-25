import React from "react";

import { ethers } from "ethers";
import namehash from "eth-ens-namehash";

import deploymentMap from "../deployments/map.json"
import EFDArtifact from "../artifacts/contracts/EthereumFriendDirectory.sol/EthereumFriendDirectory.json"
import ReverseRecordsArtifact from "../artifacts/@ensdomains/reverse-records/contracts/ReverseRecords.sol/ReverseRecords.json"

import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Transfer } from "./Transfer";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";
import { Nav } from "./Nav"
import HeaderUser from "./HeaderUser";
import User from "./User";
import UserList from "./UserList";

import "./App.css"

var testUser = {ens: "hello.eth", address: "0xbF6aE81C7f53A19246174bB18464Ca26f0b2A2BE", friends: [
  "0xbF6aE81C7f53A19246174bB18464Ca26f0b2A2B6",
  "0x12F904C8721f2E93825cbE91c1aB08f5656Ab5DF",
  "0x12F904C8721f2E93825cbE91c1aB08f5656Ab5DD"
]} 

var testUsers = [
  {ens: "hello.eth", address: "0xbF6aE81C7f53A19246174bB18464Ca26f0b2A2B6", friends: []}, 
  {ens: "hehehe.eth", address: "0x12F904C8721f2E93825cbE91c1aB08f5656Ab5DF", friends: []},
  {ens: "stephan.eth", address: "0x12F904C8721f2E93825cbE91c1aB08f5656Ab5DD", profileImage: "https://avatars.githubusercontent.com/u/5469870?v=4", friends: []}
]

// This is the Hardhat Network id, you might change it in the hardhat.config.js
// Here's a list of network ids https://docs.metamask.io/guide/ethereum-provider.html#properties
// to use when deploying to other networks.
const HARDHAT_NETWORK_ID = '31337';

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    this.initialState = {
      efs: undefined,
      reverseRecords: undefined,
      selectedAddress: undefined,
      displayedAddress: undefined,
      searchQuery: ""
    };

    this.state = this.initialState;

    this._onSearch = this._onSearch.bind(this);
    this._onSearchChange = this._onSearchChange.bind(this);
  }

  render() {
    // Ethereum wallets inject the window.ethereum object. If it hasn't been
    // injected, we instruct the user to install MetaMask.
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // Note that we pass it a callback that is going to be called when the user
    // clicks a button. This callback just calls the _connectWallet method.
    // if (!this.state.selectedAddress) {
    //   return (
    //     <ConnectWallet 
    //       connectWallet={() => this._connectWallet()} 
    //       networkError={this.state.networkError}
    //       dismiss={() => this._dismissNetworkError()}
    //     />
    //   );
    // }

    if (!this.state.efs) {
      return <Loading />;
    }

    return (
      <div className="App">
        <Nav connectWallet={() => this._connectWallet()} 
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
          selectedAddress={this.state.selectedAddress}
          searchQuery={this.state.searchQuery}
          onSearchChange={this._onSearchChange}
          onSearchSubmit={this._onSearch}
          />
        <div style={{display: "flex", justifyContent: "center"}}>
          <div style={{marginTop: "50px"}}>
            <div style={{display: "flex", justifyContent: "center"}}>
              <div style={{marginLeft: "-40px"}}>
                {
                  this.state.displayedAddress ? <HeaderUser displayedAddress={this.state.displayedAddress} selectedAddress={this.state.selectedAddress}/> : <></>
                }
                
              </div>
            </div>
            
            <UserList title="Friends" users={testUsers}></UserList>
          </div>
        </div>
      </div>
    );
  }

  async componentDidMount() {
    this._initialize()
  }

  async _connectWallet() {
    const request = await window.ethereum.send('eth_requestAccounts')
    
    const [selectedAddress] = request.result

    if (!this._checkNetwork()) {
      return;
    }

    this._initialize(selectedAddress);

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      console.log("changed")
      
      if (newAddress === undefined) {
        return this._resetState();
      }
      
      this._initialize(newAddress);
    });
  }

  async _initialize(userAddress) {
    if (userAddress === undefined) {
      if (window.ethereum.isConnected()) {
        this._connectWallet()
        return
      }
    }
    
    window.ethereum.on("chainChanged", ([networkId]) => {
      this._resetState();
    });

    this.setState({
      selectedAddress: userAddress,
    }, () => {
      console.log(userAddress, this.selectedAddress)
    });

    this._intializeEthers();
  }

  async _intializeEthers() {
    this._provider = new ethers.providers.Web3Provider(window.ethereum);
    this._loadContracts()
  }

  async _loadContracts() {
    let chainId = await window.ethereum.request({ method: 'eth_chainId' });
    chainId = parseInt(chainId)

    const efs = new ethers.Contract(
      deploymentMap.contracts[chainId].EthereumFriendDirectory[0],
      EFDArtifact.abi,
      this._provider.getSigner(0)
    )

    const reverseRecords = new ethers.Contract(
      deploymentMap.contracts[chainId].ReverseRecords[0],
      ReverseRecordsArtifact.abi,
      this._provider.getSigner(0)
    )

    this.setState({
      efs,
      reverseRecords
    })
  }

  async _onSearch(e) {
    e.preventDefault();

    if (this.state.searchQuery.length == 0) {
      return
    }

    this.setState({
      searchQuery: "",
      displayedAddress: this.state.searchQuery
    }, async () => this._userFromAddress(this.state.displayedAddress));
  }

  async _onSearchChange(e) {
    this.setState({searchQuery: e.target.value});
  }

  async _userFromAddress(address) {
    // TODO
    /** 
     * 1. Get adj
     * 2. Resolve user + adj addresses
     */

    console.log(this.state.efs)

    const [adj, _] = await this.state.efs.getAdj(address)
    const allNames = await this.state.reverseRecords.getNames([address, ...adj])
    const validNames = allNames.filter((n) => namehash.normalize(n) === n)
    console.log(validNames)
  }


  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  _resetState() {
    this.setState(this.initialState);
    this._initialize()
  }

  _checkNetwork() {
    if (window.ethereum.networkVersion === HARDHAT_NETWORK_ID) {
      return true;
    }

    this.setState({ 
      networkError: 'Please connect Metamask to Localhost:8545'
    });

    return false;
  }
}