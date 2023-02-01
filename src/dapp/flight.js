export default class Flight {
  timestamp = '';
  flightNumber = '';
  status = '';
  airlineAddress = '';
  key = '';
  passengers = [];

  constructor(airline, flightNumber, key, timestamp, status) {
    this.airlineAddress = airline;
    this.flightNumber = flightNumber;
    this.timestamp = timestamp;
    this.status = status;
    this.key = key;
  }
}
