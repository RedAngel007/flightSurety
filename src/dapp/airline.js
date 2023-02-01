import Flight from './flight';

export default class Airline {
  airlineAddress = '';
  regFeePaid = false;

  constructor(address, regFeePaid) {
    this.airlineAddress = address;
    this.regFeePaid = regFeePaid;
  }
}
