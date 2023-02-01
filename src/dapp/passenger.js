export default class Passenger {
  address = '';
  flightNumber = '';
  insuranceAmount = 0;

  constructor(address, flightNumber, insuranceAmount) {
    this.address = address;
    this.flightNumber = flightNumber;
    this.insuranceAmount = insuranceAmount;
  }
}
