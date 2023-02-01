

const { AsyncSeriesWaterfallHook } = require('tapable');
var Test = require('../config/testConfig.js');
const { assert } = require('chai');
const Web3 = require('web3');


contract('Oracles', async (accounts) => {
  const oracles = accounts.slice(30, 40);

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);

    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;
  });

  it('can register oracles', async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();
    // ACT
    for (i in oracles) {
      console.log('oracleAddress----', oracles[i]);
      config.flightSuretyApp.registerOracle({
        from: oracles[i],
        value: fee,
      });

      await config.sleep(1000);
    }

    let oracleCount = await config.flightSuretyApp.getOracleCount.call();

    assert.isAbove(
      oracleCount.toNumber(),
      1,
      'More than one oracle should exist'
    );
  });

  it('should pay 1 ether to register oracle', async () => {
     // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();
    let newBatchOracles = accounts.slice(40, 45);

    let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    // ACT
    for (i in newBatchOracles) {

      let oracle = newBatchOracles[i];
      console.log('oracle-----', oracle);

      let balance = await web3.eth.getBalance(oracle);

      console.log('oracleAddress----', oracle);
      config.flightSuretyApp.registerOracle({
        from: oracle,
        value: fee,
      });

      let balanceAfterRegister = await web3.eth.getBalance(oracle);
      let difference = parseInt(balance) - parseInt(balanceAfterRegister);

      assert.isAtLeast(1, difference);
      await config.sleep(1000);
    }
  })

  it('can request flight status', async () => {
    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    let airlineAddress = accounts[1];

    await config.flightSuretyApp.registerFlight(
      airlineAddress,
      flight,
      timestamp
    );

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(
      airlineAddress,
      flight,
      timestamp
    );

    // ACT
    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature

    for (a in oracles) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: oracles[a],
      });
      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            airlineAddress,
            flight,
            timestamp,
            STATUS_CODE_ON_TIME,
            { from: oracles[a] }
          );
        } catch (e) {
          // Enable this when debugging
          console.log(
            '\nError',
            idx,
            oracleIndexes[idx].toNumber(),
            flight,
            timestamp
          );
        }
      }
    }
  });
});
