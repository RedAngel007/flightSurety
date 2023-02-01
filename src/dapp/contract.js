import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';

import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import Airline from './airline';
import Flight from './flight';
import Passenger from './passenger';
import PassengerWallet from './passengerWallet';
import Utility from './utility';

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.web3WS = new Web3(
      new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws'))
    );

    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.flightSuretyAppWS = new this.web3WS.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );

    this.flightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataAddress
    );

    this.owner = '';
    this.airlines = [];
    this.passengers = [];
    this.registeredAirlines = [];
    this.flights = [];
    this.passengerWallets = [];

    this.initialize(callback);
  }

  async initialize(callback) {
    let accounts = await this.web3.eth.getAccounts();

    if (accounts.length) {
      this.owner = accounts[0];
      this.airlines = accounts.slice(1, 10);
      this.passengers = accounts.slice(11, 31);
      this.web3.eth.defaultAccount = this.owner;
    }

    console.log('this.airlines', this.airlines);
    console.log('this.passengers', this.passengers);

    await this.eventsSetup();

    await callback();
  }

  async eventsSetup() {
    // Rebuild the entire UI from the eventlog
    try {
      let pastEvents = await this.flightSuretyAppWS.getPastEvents('allEvents', {
        fromBlock: 0,
        toBlock: 'latest',
      });

      console.log(
        '---pastEvents',
        pastEvents.filter((log) => {
          return log.event == 'FlightStatusInfo';
        })
      );

      for (let log of pastEvents) {
        let {
          airline,
          flight,
          timestamp,
          status,
          passenger,
          key,
          depositedAmount,
          airlineAddress,
        } = log.returnValues;

        switch (log.event) {
          case 'FirstAirlIneRegistered':
            let firstAirline = new Airline(airlineAddress, true);

            this.registeredAirlines.push(firstAirline);
            break;
          case 'AirlineRegistered':
            let airline = new Airline(airlineAddress, false);

            this.registeredAirlines.push(airline);

            break;
          case 'AirlinePaidRegistrationFee':
            for (let airline of this.registeredAirlines) {
              console.log('airline---', airline);
              if (airline.airlineAddress == airlineAddress) {
                airline.regFeePaid = true;
              }
            }
            break;
          case 'FlightRegistered':
            let newFlight = new Flight(
              log.returnValues.airlineAddress,
              log.returnValues.flight,
              log.returnValues.key,
              log.returnValues.timestamp,
              0
            );
            this.flights.push(newFlight);

            break;
          case 'FlightStatusInfo':
            let flightToUpdate = this.flights.filter((newflight) => {
              return newflight.flightNumber == flight;
            });

            if (flightToUpdate.length > 0) {
              flightToUpdate[0].status = status;
            }

            break;
          case 'PassengerDepositedInsurance':
            let flght = this.flights.find((flight) => {
              return flight.key == key;
            });

            let newPassenger = new Passenger(
              passenger,
              flght.flightNumber,
              depositedAmount
            );

            this.flights
              .find((flight) => {
                return (
                  flight.key == key &&
                  (flight.status == 0 || flight.status == 20)
                );
              })
              .passengers.push(newPassenger);

            //reload()
            break;

          case 'LateAirlineInsuranceProcessed':
            let lateFlight = this.flights.find((flight) => {
              return flight.key == key;
            });

            if (lateFlight != undefined) {
              lateFlight.passengers.forEach((passenger) => {
                let passengerWallet = this.passengerWallets.find((wallet) => {
                  return wallet.passengerAddress == passenger.address;
                });

                if (!passengerWallet) {
                  passengerWallet = new PassengerWallet(passenger.address);
                  this.passengerWallets.push(passengerWallet);
                }

                passengerWallet.balance += 1.5 * passenger.insuranceAmount;
              });

              console.log(' this.passengerWallets---', this.passengerWallets);
            }

            break;

          case 'InsuranceWithdrawal':
            let wallet = this.passengerWallets.find((wallet) => {
              return wallet.passengerAddress == passenger;
            });

            if (wallet == undefined) return;

            wallet.balance = 0;

            console.log('passengerWallets---', this.passengerWallets);
            break;

          case 'RegisterFlightRequest':
            break;
          case 'OracleReport':
            break;
          default:
        }
      }
    } catch (error) {
      console.log('error while fetching events.', error);
      throw new Error('Error while fetching events');
    }
  }

  isOperational(callback) {
    let resp = this.flightSuretyApp.methods
      .isOperational()
      .call({ from: this.owner }, callback);

    return resp;
  }

  async fetchFlightStatus(airline, flight, timestamp, callback) {
    console.log('this.owner----', this.owner);
    let resp = await this.flightSuretyApp.methods
      .fetchFlightStatus(airline, flight, timestamp)
      .send({ from: this.owner });
  }

  async registerAirline(address, registeredBy) {
    // first check that the caller is a registered airline
    let isValidAddress = this.airlines.some(
      (airlineAddress) => airlineAddress === address
    );

    let isRegisterAddress = this.airlines.some(
      (airlineAddress) => airlineAddress === registeredBy
    );

    if (!isRegisterAddress) {
      console.error(
        'Airline cannot be registered by this address',
        this.airlines.length
      );

      return;
    }
    if (!isValidAddress) {
      console.error('Address is not a valid airline address ');
      return;
    }

    let resp = await this.flightSuretyApp.methods
      .registerAirline(address)
      .send({ from: registeredBy });

    reload();
  }

  async registerFlight(airlineAddress, flightNumber, timestamp) {
    try {
      let resp = await this.flightSuretyApp.methods
        .registerFlight(airlineAddress, flightNumber, timestamp)
        .send({
          from: airlineAddress,
          gasLimit: 500000,
        });

      if (resp) {
        reload();
      }
    } catch (e) {
      console.log(e);
    }
  }

  async makePaymentForAirline(airlineAddress) {
    let utility = new Utility();

    let regFee = utility.toWei('10');

    await this.flightSuretyApp.methods
      .payAirlineRegisterationFee(airlineAddress)
      .send({ from: airlineAddress, value: regFee, gasLimit: 500000 });
    reload();
  }

  async purchaseInsurance(flightNumber, passengerAddress, insuranceAmount) {
    let mainflight = this.flights.find((flight) => {
      return flight.flightNumber == flightNumber;
    });

    if (mainflight == undefined) return;

    let filteredPassengers;

    if (mainflight.passengers != undefined)
      filteredPassengers = mainflight.passengers.find((passenger) => {
        return passenger.address == passengerAddress;
      });

    if (filteredPassengers != undefined) return;

    let airline = mainflight.airlineAddress;
    let timestamp = mainflight.timestamp;

    let utility = new Utility();

    let value = utility.toWei(insuranceAmount);

    await this.flightSuretyApp.methods
      .insurePassenger(airline, flightNumber, timestamp, value)
      .send({
        from: passengerAddress,
        value: value,
        gasLimit: 500000,
      });

    reload();
  }

  async withdraw(passengerAddress) {
    await this.flightSuretyApp.methods
      .withdrawBalance(passengerAddress)
      .send({ from: passengerAddress, gasLimit: 500000 });

    reload();
  }

  async convertToUnits(value) {
    const decimals = 18;
    return ethers.utils.parseUnits(value, decimals);
  }
}
