import Web3 from "web3";

export default class Utility {
  toEther(amount) {
    return Web3.utils.fromWei(amount, 'ether');
  }

  toWei(amount) {
    return Web3.utils.toWei(amount, 'ether');
  }
}
