import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';
import Utility from './utility';

let timestampToHumanFormat = (timestamp) => {
  let date = new Date(timestamp * 1000);
  return `${date.getDate()}/${
    date.getMonth() + 1
  }/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
};

let utility = new Utility();

let flightStatuses = {
  0: 'Unknown',
  10: 'On Time',
  20: 'Late',
  30: 'Late Weather',
  40: 'Late Technical',
  50: 'Late Other',
};

let updateRegisteredAirlineSelect = (contract) => {
  var registeredAirlineSelect = document.getElementById(
    'registered-by-address'
  );

  var flightAirlineSelect = document.getElementById('fight-airline-address');

  contract.registeredAirlines
    .filter((airline) => {
      return airline.regFeePaid;
    })
    .forEach((airline) => {
      registeredAirlineSelect
        .appendChild(new Option(airline.airlineAddress, airline.airlineAddress))
        .cloneNode(true);

      flightAirlineSelect
        .appendChild(new Option(airline.airlineAddress, airline.airlineAddress))
        .cloneNode(true);
    });
};

function displayAllAirlines(contract) {
  let body = document.getElementById('airlines');
  for (let airline of contract.registeredAirlines) {
    let isRegistered = airline.regFeePaid;
    let status = isRegistered ? 'Can Vote' : 'Fee Not Paid';

    let airlineAddress = airline.airlineAddress.slice(0, 30) + '....';
    let newRow = body.appendChild(
      DOM.div({
        className: 'table-headers table-row-data table-row',
        id: `${airline.airlineAddress}`,
      })
    );

    newRow.appendChild(
      DOM.div({ className: 'table-cell table-cell-1' }, `${airlineAddress}`)
    );
    newRow.appendChild(
      DOM.div({ className: 'table-cell table-cell-2 status' }, `${status}`)
    );

    let cellThree = newRow.appendChild(DOM.div({ className: 'table-cell' }));

    if (isRegistered) {
      cellThree.appendChild(
        DOM.button(
          { name: 'unregister', className: 'btn btn-danger' },
          'Remove'
        )
      );
    } else {
      cellThree.appendChild(
        DOM.button(
          {
            name: 'pay-fee',
            className: 'btn btn-primary',
            id: `${airline.airlineAddress}`,
          },
          'Register'
        )
      );
    }
  }

  let payFeeButtons = document.getElementsByName('pay-fee');

  for (let element of payFeeButtons) {
    let airlineAddress = element.id;

    element.addEventListener('click', async (self) => {
      await contract.makePaymentForAirline(airlineAddress);
    });
  }
}

function displayFlights(contract) {
  let body = document.getElementById('flights');
  for (let flight of contract.flights) {
    let address = flight.airlineAddress.slice(0, 30) + '...';
    let flightNumber = flight.flightNumber;
    let status = flightStatuses[flight.status];
    let stlyeClass =
      status == 'Unknown' ? 'btn btn-primary' : 'btn btn-primary disabled';

    let newRow = body.appendChild(
      DOM.div({
        className: 'table-headers table-row-data table-row',
      })
    );

    newRow.appendChild(
      DOM.div({ className: 'table-cell table-cell-1' }, `${address}`)
    );
    newRow.appendChild(
      DOM.div(
        { className: 'table-cell table-cell-2 status' },
        `${flightNumber}`
      )
    );
    newRow.appendChild(
      DOM.div({ className: 'table-cell table-cell-2 status' }, `${status}`)
    );

    let buttonCell = newRow.appendChild(
      DOM.div({ className: 'table-cell  table-cell-3' })
    );

    buttonCell.appendChild(
      DOM.button(
        {
          name: 'flight-status',
          className: `${stlyeClass}`,
          id: `${flightNumber}`,
        },
        'Fetch Status'
      )
    );
  }

  let flightStatusButtons = document.getElementsByName('flight-status');

  for (let element of flightStatusButtons) {
    let flightNumber = element.id;
    let filteredFlight = contract.flights.filter((flight) => {
      return flight.flightNumber == flightNumber;
    })[0];
    if (filteredFlight.status == 0) {
      element.addEventListener('click', async (self) => {
        await contract.fetchFlightStatus(
          filteredFlight.airlineAddress,
          filteredFlight.flightNumber,
          filteredFlight.timestamp
        );
      });
    }
  }
}

function displayPassengers(contract) {
  let body = document.getElementById('passengers');
  for (let flight of contract.flights) {
    console.log('flight----1', flight);
    for (let passenger of flight.passengers) {
      let address = passenger.address;
      let flightNumber = flight.flightNumber;
      //let insuranceAmount = passenger.insuranceAmount;
      let insuranceAmount = utility.toEther(
        passenger.insuranceAmount.toString()
      );

      let status =
        flightStatuses[flight.status] == 'Late'
          ? 'Withdrawable'
          : 'Not Withdrawable';

      let newRow = body.appendChild(
        DOM.div({
          className: 'table-headers table-row-data table-row',
        })
      );

      newRow.appendChild(
        DOM.div(
          { className: 'table-cell table-cell-1' },
          `${address.slice(0, 30)}...`
        )
      );

      newRow.appendChild(
        DOM.div(
          { className: 'table-cell table-cell-2 status' },
          `${flightNumber}`
        )
      );

      newRow.appendChild(
        DOM.div(
          { className: 'table-cell table-cell-2 status' },
          `${insuranceAmount}`
        )
      );

      newRow.appendChild(
        DOM.div({ className: 'table-cell table-cell-2 status' }, `${status}`)
      );
    }
  }
}

function displayPassengerWallets(contract) {
  let body = document.getElementById('passenger-balances');

  console.log(contract.passengerWallets);

  let utility = new Utility();

  for (let passengerWallet of contract.passengerWallets) {
    let address = passengerWallet.passengerAddress;
    let balance = utility.toEther(passengerWallet.balance.toString());

    let stlyeClass =
      balance > 0 ? 'btn btn-primary' : 'btn btn-primary disabled';

    let newRow = body.appendChild(
      DOM.div({
        className: 'table-headers table-row-data table-row',
      })
    );

    newRow.appendChild(
      DOM.div(
        { className: 'table-cell table-cell-1' },
        `${address.slice(0, 30)}...`
      )
    );

    newRow.appendChild(
      DOM.div({ className: 'table-cell table-cell-2 status' }, `${balance}`)
    );

    let buttonCell = newRow.appendChild(
      DOM.div({ className: 'table-cell  table-cell-3' })
    );

    buttonCell.appendChild(
      DOM.button(
        {
          name: 'withdraw',
          className: `${stlyeClass}`,
          id: `${address}`,
        },
        'Withdraw'
      )
    );
  }

  let withdrawButtons = document.getElementsByName('withdraw');

  for (let element of withdrawButtons) {
    let passengerAddress = element.id;
    element.addEventListener('click', async (self) => {
      await contract.withdraw(passengerAddress);
    });
  }
}

(async () => {
  let contract = new Contract('localhost', () => {
    // Read transaction
    displayAllAirlines(contract);
    displayFlights(contract);
    displayPassengers(contract);
    displayPassengerWallets(contract);
    updateRegisteredAirlineSelect(contract);

    contract.isOperational((error, result) => {
      if (error) {
        document.getElementById('offline').style.display = 'block';
        document.getElementById('online').style.display = 'none';
      } else {
        document.getElementById('offline').style.display = 'none';
        document.getElementById('online').style.display = 'block';
      }
    });

    // Register an airline
    DOM.elid('register-airline').addEventListener('click', async () => {
      console.log('registeredAirlines', contract.airlines);
      let registeredBy = DOM.elid('registered-by-address').value;
      let airlineToRegister = DOM.elid('airline-to-register').value;

      contract.registerAirline(
        airlineToRegister,
        registeredBy,
        (error, result) => {
          if (!error) {
            contract.registeredAirlines.push(airlineToRegister);
          } else {
          }
        }
      );
    });

    // Register an flight
    DOM.elid('register-flight').addEventListener('click', async () => {
      let flightNumber = DOM.elid('flight-number').value;
      let timestamp = Math.floor(Date.now() / 1000);
      let airlineAddress = DOM.elid('fight-airline-address').value;
      await contract.registerFlight(airlineAddress, flightNumber, timestamp);
    });

    // Purchase Insurance
    DOM.elid('purchase-insurance').addEventListener('click', async () => {
      let flightNumber = DOM.elid('insurance-flight').value;
      let passengerAddress = DOM.elid('insurance-address').value;
      let insuranceAmount = DOM.elid('insurance-amount').value;
      console.log(flightNumber, passengerAddress, insuranceAmount);
      await contract.purchaseInsurance(
        flightNumber,
        passengerAddress,
        insuranceAmount
      );
    });
  });
})();
