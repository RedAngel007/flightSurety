const HDWalletProvider = require('@truffle/hdwallet-provider');

const mnemonicPhrase =
  'perfect celery short patch promote island major place lab submit fence sort'; // 12 word mnemonic

import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import Oracle from './oracle.js';

const sleep = (ms) => {
  return new Promise((resolve, reject) => setTimeout(resolve, ms));
};

let config = Config['localhost'];

let web3 = new Web3(new Web3.providers.HttpProvider(config.url));
let web3WebSocket = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws'))
);

let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);
//Events can only be read with websock
let flightSuretyAppWS = new web3WebSocket.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

web3.eth.defaultAccount = web3.eth.accounts[0];

let oracles = [];

const StatusCodes = new Uint8Array([10, 20, 20, 20, 20, 20, 20, 20, 30, 40, 50]);

let registerOracles = async (oracleAddresses, registrationFee) => {
  oracles = [];

  for (let i = 0; i < oracleAddresses.length; i++) {
    await sleep(1000);

    let address = oracleAddresses[i];
    console.log('address---', address);
    const statusIndex = Math.floor(Math.random() * StatusCodes.length);
    let oracleIsRegistered = await flightSuretyApp.methods
      .isOracleRegistered(address)
      .call();

    if (!oracleIsRegistered) {
      try {
        await flightSuretyApp.methods.registerOracle().send({
          from: address,
          value: registrationFee,
          gasLimit: 5000000,
        });

        let oracle = new Oracle(address);
        oracle.statusCode = StatusCodes[statusIndex];
        oracle.isRegistered = true;
        oracles.push(oracle);
            console.log('Registered Oracle---', address);

      } catch (error) {
        console.log('Error during registration ', error.message);
      }
    } else {
      let existInServer =
        oracles.filter((oracle) => {
          oracle.address == address;
        }).length == 1;

      if (!existInServer) {
        let oracle = new Oracle(address);
        oracle.isRegistered = true;
        oracle.indexes = await flightSuretyApp.methods
          .getMyIndexes()
          .call({ from: address });
          oracle.statusCode = StatusCodes[statusIndex];
        oracles.push(oracle);
        console.log('oracle', oracle);
      }
      console.log(
        `oracle ${address} already registered, skipping registration`
      );
    }
  }
};

(async () => {
  let accounts = await web3.eth.getAccounts();
  const oracleAddresses = accounts.slice(30, 50); // 20 oracle addresses;

  let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();

  await registerOracles(oracleAddresses, fee); // ensure oracles exist in contract memory and persist

  flightSuretyAppWS.events
    .allEvents()
    .on('data', async (log) => {
      let { index, airline, flight, timestamp, key } = log.returnValues;

      switch (log.event) {
        case 'OracleRequest':
          let elligibleOracles = oracles.filter((oracle) => {
            let indexes = oracle.indexes;
            return indexes.includes(index);
          });

          for (let oracle of elligibleOracles) {
            try {
              let res = await flightSuretyApp.methods
                .submitOracleResponse(
                  index,
                  airline,
                  flight,
                  timestamp,
                  oracle.statusCode
                )
                .send({ from: oracle.address, gasLimit: 5000000 });

            } catch (error) {
              console.error(error.message);
            }
          }

          break;
      }
    })
    .on('error', (error, receipt) => {
      console.log('received event error: ', error);
      console.log('received recept error: ', receipt);
    });
})();

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!',
  });
});

export default app;
