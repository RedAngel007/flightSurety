let FlightSuretyApp = artifacts.require('FlightSuretyApp');
let FlightSuretyData = artifacts.require('FlightSuretyData');

var Test = require('../config/testConfig.js');
const { assert } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();
const { expect } = chai;
const { expectEvent } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup.js');

let airlines,
  owner,
  passengers,
  flightSuretyData,
  flightSuretyApp,
  firstAirline,
  regFee,
  timestamp,
  sleep;
contract('Flight Surety Tests', async (accounts) => {
  var config;
  before('setup contract', async () => {
    timestamp = Math.floor(Date.now() / 1000);
    config = await Test.Config(accounts);
    airlines = accounts.slice(1, 21);
    passengers = accounts.slice(21, 30);
    owner = accounts[0];
    firstAirline = airlines[0];
    flightSuretyData = await FlightSuretyData.new({ from: owner });
    flightSuretyApp = await FlightSuretyApp.new({ from: owner });

    sleep = async (milliseconds) => {
      await new Promise((resolve) => {
        return setTimeout(resolve, milliseconds);
      });
    };
    regFee = web3.utils.toWei('10', 'ether');

    console.log('regFee---', regFee);

    await flightSuretyApp.setUp(flightSuretyData.address, firstAirline, {
      from: owner,
      value: regFee,
    });
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await flightSuretyData.isOperational.call();
    assert.equal(status, true, 'Incorrect initial operating status value');
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await flightSuretyData.setOperatingStatus(false, {
        from: testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }

    assert.equal(accessDenied, true, 'Access not restricted to Contract Owner');
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }

    assert.equal(
      accessDenied,
      false,
      'Access not restricted to Contract Owner'
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await flightSuretyData.setOperatingStatus(false);
    let reverted = false;

    try {
      await flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }

    assert.equal(reverted, true, 'Access not blocked for requireIsOperational');

    // Set it back for other tests to work
    await flightSuretyData.setOperatingStatus(true);
  });

  //------------------------------------
  // region Airline Tests
  //------------------------------------
  it('(airline) that has not staked 10 eth is not considered registered', async () => {
    // ARRANGE
    let newAirline = airlines[1];

    // ACT
    try {
      await flightSuretyApp.registerAirline(newAirline, {
        from: firstAirline,
      });
    } catch (e) {}

    let result = await flightSuretyData.isRegistered.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );

    await flightSuretyApp.payAirlineRegisterationFee(newAirline, {
      from: newAirline,
      value: regFee,
      gasLimit: 5000000,
    });

    result = await flightSuretyData.isRegistered.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      true,
      'Airline should be registered only after the 10 ether fee is paid'
    );
  });

  it('(airline) address cannot be an oracle', async () => {
    let newAirline = accounts[31];

    // ACT
    await flightSuretyApp.registerOracle({
      from: accounts[31],
      value: regFee,
    });

    await sleep(1000);

    try {
      let { success, vote } = await flightSuretyApp.registerAirline.call(
        newAirline,
        {
          from: firstAirline,
        }
      );
    } catch (e) {
      console.log('e.data.reason', e);
      assert.include(e.toString(), 'Address is an oracle address');
    }
  });

  it('First Airline is Registered', async () => {
    let allAirline = await flightSuretyData.getAllAirlines.call();
    console.log('allAirline---', allAirline);

    let isAirlineRegistered = await flightSuretyData.isRegistered.call(
      firstAirline
    );

    console.log('isAirlineRegistered----', isAirlineRegistered);

    assert.equal(
      isAirlineRegistered,
      true,
      'First airline should be automatically registered'
    );
  });

  it('1st airline can register a new airline', async () => {
    // ARRANGE
    let newAirline = airlines[1];

    // ACT
    try {
      await flightSuretyApp.registerAirline(newAirline, {
        from: firstAirline,
      });

      await flightSuretyApp.payAirlineRegisterationFee(newAirline, {
        from: newAirline,
        value: regFee,
        gasLimit: 5000000,
      });
    } catch (e) {}

    let result = await flightSuretyData.isRegistered.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      true,
      'Airline can only be registered by anothr registered airline'
    );
  });

  it('should not register an airline that is already registered', async () => {
    // ARRANGE
    let newAirline = airlines[1];
    let success, votes;
    // ACT
    try {
      success = await flightSuretyApp.registerAirline(newAirline, {
        from: firstAirline,
      });
    } catch (e) {
      // ASSERT
      assert.equal(
        success,
        false,
        'An airline that has been registered before cannot be registered again'
      );
    }
  });

  it('(airline) Only a airline that is in the registration queue can pay the 10 eth  staking fee', async () => {
    await flightSuretyApp
      .payAirlineRegisterationFee(firstAirline, {
        from: firstAirline,
        value: regFee,
        gasLimit: 5000000,
      })
      .should.be.rejectedWith(
        'Only airlines in Registration Queue can stake 10 eth'
      );
  });

  it('(airline) must pay above 10 eth to stake', async () => {
    let newAirline = airlines[2];

    await flightSuretyApp.registerAirline(newAirline, {
      from: firstAirline,
    });

    await flightSuretyApp
      .payAirlineRegisterationFee(newAirline, {
        from: newAirline,
        value: web3.utils.toWei('9', 'ether'),
        gasLimit: 5000000,
      })
      .should.be.rejectedWith('Airline registration fee should be >= 10 eth');

    await flightSuretyApp.payAirlineRegisterationFee(newAirline, {
      from: newAirline,
      value: web3.utils.toWei('10', 'ether'),
      gasLimit: 5000000,
    });

    let result = await flightSuretyData.isRegistered.call(newAirline);

    // ASSERT
    assert.equal(result, true, 'Airline registration fee should be >= 10 eth');
  });

  it('(airline) requires half of airlines to register a new airline if airines count > 4 ', async () => {
    //3 airlines already registered, Register 4 and 5th
    let thirdAirline = airlines[3];
    let fifthAirline = airlines[4]

    await flightSuretyApp.registerAirline(thirdAirline, {
      from: firstAirline,
    });

    await flightSuretyApp.payAirlineRegisterationFee(thirdAirline, {
      from: thirdAirline,
      value: web3.utils.toWei('10', 'ether'),
      gasLimit: 5000000,
    });

     await flightSuretyApp.registerAirline(fifthAirline, {
       from: firstAirline,
     });

     await flightSuretyApp.payAirlineRegisterationFee(fifthAirline, {
       from: fifthAirline,
       value: web3.utils.toWei('10', 'ether'),
       gasLimit: 5000000,
     });

    let sixthAirline = airlines[5];

    let result = await flightSuretyApp.registerAirline(sixthAirline, {
      from: firstAirline,
    });

    //Since we have more than 4 airlines, consesus mechanism should kick in
    expectEvent(result, 'UpdatedVotersList', { voters: [firstAirline] });
    expectEvent(result, 'AirlineVoted', {
      voter: firstAirline,
      votersCount: '1',
    });

    //Check for multiple votes
    await flightSuretyApp
      .registerAirline(sixthAirline, {
        from: firstAirline,
      })
      .should.be.rejectedWith('Address already voted');

    // Second consensus
    let result2 = await flightSuretyApp.registerAirline(sixthAirline, {
      from: airlines[1],
    });
    expectEvent(result2, 'UpdatedVotersList', {
      voters: [firstAirline, airlines[1]],
    });


    //3rd consensus
    let result3 = await flightSuretyApp.registerAirline(sixthAirline, {
      from: airlines[2],
    });

    expectEvent(result3, 'UpdatedVotersList', {
      voters: [firstAirline, airlines[1], airlines[2]],
    });


    expectEvent(result3, 'AirlineRegistered', { airlineAddress: sixthAirline });

    //Airline can pay 10 eth now cos he is in the registration queue after >= 50% consensus
    await flightSuretyApp.payAirlineRegisterationFee(sixthAirline, {
      from: sixthAirline,
      value: web3.utils.toWei('10', 'ether'),
      gasLimit: 5000000,
    });

    let result6 = await flightSuretyData.isRegistered.call(sixthAirline);

    // ASSERT
    assert.equal(result6, true, 'Airline registration fee should be >= 10 eth');
  });
  // endregion

  //------------------------------------
  // region Flight Passenger Tests
  //------------------------------------

  it('(flight) can only be registered if airline is registered', async () => {
    let unregisteredAirline = airlines[7];

    let result = await flightSuretyData.isRegistered.call(unregisteredAirline);
    // Ensure airline is not registered
    assert.equal(result, false, 'Airline registration fee should be >= 10 eth');

    await flightSuretyApp
      .registerFlight(unregisteredAirline, 'FN1234', timestamp)
      .should.be.rejectedWith('Airline is not registered');


    let result1 = await flightSuretyApp.registerFlight(
      airlines[0],
      'FN1234',
      timestamp
    ).should.be.fulfilled;

    console.log('result1----', result1.receipt.status)
  });

  it('(Passenger) can only subscribe if flight is in unknown status', async () => {
    // update flight status to late status
       await flightSuretyApp.ProcessFlightStatus(
         airlines[0],
         'FN1234',
         timestamp,
         20
       );

    await flightSuretyApp
      .insurePassenger(
        airlines[0],
        'FN1234',
        timestamp,
        web3.utils.toWei('1', 'ether')
      )
      .should.be.rejectedWith(
        'Insurance can only be purchased for flights with status unknown'
      );
  });

  it('(Passenger) can only buy insurance for same flight once', async () => {
    let insuranceAmount = web3.utils.toWei('1', 'ether');

    //Register new flights
    await flightSuretyApp.registerFlight(
      airlines[4],
      'FN2234',
      timestamp
    );

    //buy insurance for passenger in Flight  FN2234
    await flightSuretyApp.insurePassenger(
      airlines[4],
      'FN2234',
      timestamp,
      insuranceAmount,
      {
        from: passengers[0],
        value: insuranceAmount,
        gasLimit: 5000000,
      }
    );

    // Trying to buy insurance for same passerger on same flight again should result in error
     await flightSuretyApp
       .insurePassenger(airlines[4], 'FN2234', timestamp, insuranceAmount, {
         from: passengers[0],
         value: insuranceAmount,
         gasLimit: 5000000,
       })
       .should.be.rejectedWith('Passenger already insured');


    // Buying insurance for same passenegr on a different flight should b successful
    await flightSuretyApp.registerFlight(
      airlines[4],
      'FN3234',
      timestamp
    );

    await flightSuretyApp.insurePassenger(
      airlines[4],
      'FN3234',
      timestamp,
      insuranceAmount,
      {
        from: passengers[0],
        value: insuranceAmount,
        gasLimit: 5000000,
      }
    );
  });

  it('(Passenger) passenger wallet balance is updated by 1.5 the insured amount if airline is late', async () => {
    let balanceBefore = await flightSuretyApp.getPassengerWithdrawableBalance(passengers[0]);

    let result = await flightSuretyApp.ProcessFlightStatus(
      airlines[4],
      'FN2234',
      timestamp,
      20
    );

    let balanceAfter = await flightSuretyApp.getPassengerWithdrawableBalance(
      passengers[0]
    );

    expectEvent(result, 'LateAirlineInsuranceProcessed', {
      flight: 'FN2234',
    });

    console.log('balanceAfter, balanceBefore---', balanceAfter, balanceBefore);

    balanceAfter =parseFloat(web3.utils.fromWei(balanceAfter, 'ether'));
    balanceBefore = parseFloat(web3.utils.fromWei(balanceBefore, 'ether'));

    assert.isAbove (balanceAfter, balanceBefore);
    assert.isAtMost(0, balanceBefore)
    assert.equal(1.5, balanceAfter - balanceBefore)
  });

  //end Region
});
