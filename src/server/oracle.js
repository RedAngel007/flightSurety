class Oracle {
  indexes = [];
  isRegistered = false;
  address = '';
  statusCode = ''; // static status codes

  constructor(address) {
    this.address = address;

  }
}

export default Oracle;
