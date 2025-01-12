import React from "react"
import { withRouter, Switch, Route, matchPath } from "react-router"
import { ethers } from "ethers"
import namehash from "eth-ens-namehash"

import deploymentMap from "../deployments/map.json"
import EFDArtifact from "../artifacts/contracts/EthereumFriendDirectory.sol/EthereumFriendDirectory.json"
import ReverseRecordsArtifact from "../artifacts/@ensdomains/reverse-records/contracts/ReverseRecords.sol/ReverseRecords.json"
import ENSRegistryArtifact from "../artifacts/@ensdomains/ens/contracts/ENSRegistry.sol/ENSRegistry.json"
import ResolverArtifact from "../artifacts/@ensdomains/resolver/contracts/Resolver.sol/Resolver.json"

import { NoWalletDetected } from "./NoWalletDetected"
import { Nav } from "./Nav"
import HeaderUser from "./HeaderUser"
import UserList from "./UserList"
import InvitePage from "./InvitePage"

import "./App.css"
import './theme.css';
import "./Spinner.css"

class Dapp extends React.Component {
  constructor(props) {
    super(props)

    this.initialState = {
      efd: undefined,
      reverseRecords: undefined,
      ensRegistry: undefined,
      resolverInterface: undefined,
      currentUser: undefined,
      displayedUser: undefined,
      searchQuery: "",
      userNotFound: false,
      ready: undefined,
      networkError: undefined,
      isConnectingWallet: false,
      theme: "light" 
      canConnectWallet: false,
      isLoading: false
    }

    this.state = this.initialState

    this._onSearch = this._onSearch.bind(this)
    this._onSearchChange = this._onSearchChange.bind(this)
    this._onSelectUser = this._onSelectUser.bind(this)
    this._onToggleTheme = this._onToggleTheme.bind(this)
    this._userFromAddress = this._userFromAddress.bind(this)
    this._refreshCurrentUser = this._refreshCurrentUser.bind(this)
    this._refreshDisplayedUser = this._refreshDisplayedUser.bind(this)
  }

  render() {
    if (this.state.networkError) {
      return <div>{this.state.networkError}</div>
    }

    if (!this.state.efd) {
      return <div>Loading...</div>
    }

    return (
      <div className={`App ${this.state.theme}`} >
        <Nav connectWallet={() => this._connectWallet()} 
          isConnectingWallet={this.state.isConnectingWallet}
          canConnectWallet={this.state.canConnectWallet}
          currentUser={this.state.currentUser}
          displayedUser={this.state.displayedUser}
          searchQuery={this.state.searchQuery}
          theme={this.state.theme}
          onSearchChange={this._onSearchChange}
          onSearchSubmit={this._onSearch}
          onSelectUser={this._onSelectUser} 
          onToggleTheme={this._onToggleTheme}
        />
          <Switch>
            <Route path="/invite/:encodedInvite" render={(route) => {
              return <div style={{display: "flex", justifyContent: "center", marginTop: "50px"}}>
                <InvitePage 
                  currentUser={this.state.currentUser} 
                  route={route} 
                  userFromAddress={this._userFromAddress} 
                  onSelectUser={this._onSelectUser} 
                  provider={this._provider}
                  efd={this.state.efd}
                  refreshCurrentUser={this._refreshCurrentUser}
                  history={this.props.history}
                  >
                </InvitePage>
              </div>
              
            }}/>

            <Route path="/account/:addressOrENS" render={ (route) => {
              return <div style={{display: "flex", justifyContent: "center"}}>
                <div style={{marginTop: "50px", marginBottom: "50px"}}>
                  {
                    this.state.displayedUser ? <>
                      <HeaderUser 
                      user={this.state.displayedUser} 
                      currentUser={this.state.currentUser} 
                      provider={this._provider} 
                      efd={this.state.efd}
                      refreshUser={this._refreshDisplayedUser}
                      refreshCurrentUser={this._refreshCurrentUser}
                      />

                      <UserList 
                      title="Friends" 
                      users={this.state.displayedUser.friends} 
                      onSelectUser={this._onSelectUser} 
                      emptyMessage={"Nothing to see here (yet!)"}
                      currentUser={this.state.currentUser}
                      displayedUser={this.state.displayedUser}
                      />
                    </> : 
                    this.state.isLoading ? <div style={{width: "20px", height: "20px"}} className="spinner"></div> :
                    this.state.userNotFound ? <>
                      {route.match.params.addressOrENS} could not be found :/
                    </> : <></>
                  }
                </div>
              </div>
            }}></Route>
          </Switch>
      </div>
    )
  }

  async componentDidMount() {
    this._initialize()
  }

  componentDidUpdate(prevProps, prevState) {

    const { pathname } = this.props.location;
    const { pathname: prevPathname } = prevProps.location;
    const params = this._getParams(pathname)
    const prevParams = this._getParams(prevPathname)

    if (params.addressOrENS) {
      if (!prevState.ready && this.state.ready) {
        this.updateUser(params.addressOrENS)
        return
      }
      if (params.addressOrENS === prevParams.addressOrENS) {
        return
      }
      this.updateUser(params.addressOrENS)
    }
  }

  _getParams = (pathname) => {
    const matchProfile = matchPath(pathname, {
      path: `/account/:addressOrENS`,
    })
    return (matchProfile && matchProfile.params) || {}
  }

  async _hasAccountConnected() {
    if (!window.ethereum) {
      return false
    }

    const accounts = await window.ethereum.request({method: "eth_accounts"})
    return accounts.length > 0
  }

  async _connectWallet() {
    this.setState({isConnectingWallet: true})
    try {
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const currentUser = await this._userFromAddress(address)
      this.setState({currentUser})
    } catch (error) {
      console.error(error)
    }
    this.setState({isConnectingWallet: false})
  }

  async _initialize(currentUser) {
    if (window.ethereum) {
      this._provider = new ethers.providers.Web3Provider(window.ethereum)
      this.setState({canConnectWallet: true})
    } else {
      // TODO: User should probably select the network somewhere
      this._provider = new ethers.providers.JsonRpcProvider("https://goerli.infura.io/v3/76f031d8c76c4d32b9b9eaca5240f4ec", "goerli") 
    }

    await this._loadContracts(this._provider)

    const isConnected = await this._hasAccountConnected()
    if (currentUser === undefined) {
      if (isConnected) {
        await this._connectWallet()
      }
    }

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", ([newAddress]) => {
        if (newAddress === undefined) {
          return this._resetState()
        }
        this._connectWallet()
      })
      
      window.ethereum.on("chainChanged", ([networkId]) => {
        this._resetState()
      })
    }

    if (isConnected) {
      await this._loadContracts(this._provider.getSigner(0))
    }
  }

  async _loadContracts(providerOrSigner) {
    const network = await this._provider.getNetwork()
    let chainId = network.chainId
    chainId = parseInt(chainId)

    if(!(chainId in deploymentMap.contracts)) {
      this.setState({ 
        networkError: "Contracts not deployed on this network."
      })
      return
    }

    const efd = new ethers.Contract(
      deploymentMap.contracts[chainId].EthereumFriendDirectory[0],
      EFDArtifact.abi,
      providerOrSigner
    )

    const reverseRecords = new ethers.Contract(
      deploymentMap.contracts[chainId].ReverseRecords[0],
      ReverseRecordsArtifact.abi,
      providerOrSigner
    )

    
    const ensRegistry = new ethers.Contract(
      deploymentMap.contracts[chainId].ENS[0],
      ENSRegistryArtifact.abi,
      providerOrSigner
    )

    const resolverInterface = new ethers.Contract(
      deploymentMap.contracts[chainId].PublicResolver[0],
      ResolverArtifact.abi, 
      providerOrSigner
    )

    this.setState({
      efd,
      reverseRecords,
      ensRegistry,
      resolverInterface,
      ready: true
    })
  }

  _onToggleTheme() {
    this.setState({theme: this.state.theme === "light" ? "dark" : "light"})
  }

  async _onSelectUser(user) {
    this.props.history.push(`/account/${user.address}`)
  }

  async _onSearch(e) {
    e.preventDefault()
    this.props.history.push(`/account/${this.state.searchQuery}`)
    this.setState({searchQuery: "", displayedUser: undefined})
  }

  async _onSearchChange(e) {
    this.setState({searchQuery: e.target.value})
  }

  async _refreshCurrentUser() {
    const currentUser = await this._userFromAddress(this.state.currentUser.address)
    this.setState({currentUser})
  } 

  async _refreshDisplayedUser() {
    const displayedUser = await this._userFromAddress(this.state.displayedUser.address)
    this.setState({displayedUser})
  }

  async updateUser(addressOrENS) {

    if (this.state.displayedUser && (this.state.displayedUser.address === addressOrENS || this.state.displayedUser.ens === addressOrENS)
    ) {
      return
    }

    this.setState({isLoading: true})

    let user
    if (addressOrENS.slice(0,2) === "0x") {
      // TODO: Validate displayed address
      user = await this._userFromAddress(addressOrENS)
    } else {
      user = await this._userFromENS(addressOrENS)
    }

    if (!user) {
      if (!this.state.userNotFound) {
        this.setState({
          userNotFound: true,
          displayedUser: null,
          isLoading: false
        })
      }
      return
    }

    this.setState({
      searchQuery: "",
      displayedUser: user, 
      userNotFound: false,
      isLoading: false
    })
  }

  async _userFromENS(name) {
    const hash = namehash.hash(name)
    const resolverAddress = await this.state.ensRegistry.resolver(hash)

    if (resolverAddress === ethers.constants.AddressZero) {
      return null
    }

    const userAddress = await this.state.resolverInterface.attach(resolverAddress)["addr(bytes32)"](hash)
    const user = await this._userFromAddress(userAddress)
    
    return user
  }

  async _userFromAddress(address) {
    console.log("call")
    const [adj] = await this.state.efd.getAdj(address)
    const allAddresses = [address, ...adj]
    const allNames = await this.state.reverseRecords.getNames(allAddresses) // TODO: Some kind of caching
     
    const ensMapping = {}
    allAddresses.forEach((a, i) => {
      const name = allNames[i]
      ensMapping[a] = name && namehash.normalize(name) === name ? name : null
    })

    return {
      ens: ensMapping[address],
      friends: adj.map(a => {return {ens: ensMapping[a], address: a.toLowerCase()}}),
      address
    }
  }

  _dismissNetworkError() {
    this.setState({ networkError: undefined })
  }

  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message
    }

    return error.message
  }

  _resetState() {
    this.setState(this.initialState)
    this._initialize()
  }
}

export default {
  Dapp: withRouter(Dapp)
}