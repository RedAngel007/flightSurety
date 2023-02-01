
var FlightSuretyApp = artifacts.require("FlightSuretyApp");
var FlightSuretyData = artifacts.require("FlightSuretyData");
var BigNumber = require('bignumber.js');

var Config = async function(accounts) {


    // These test addresses are useful when you need to add
    // multiple users in test scripts
    let testAddresses = [
      '0x9A20eF56C847e26399826cF955D1bc6489Dd9B3E',
      '0x8c3E3174558E4b1a03690D3227dA222E71A7769a',
      '0x376665ABEdfF86Da6dcabA93E889c3DD38782377',
      '0xCCb8839D3638761A32405766f7860a3909E58138',
      '0x3acDCFF477C0596f9D42d464d3eB0160eDEcBA43',
      '0x2E10b0034582092D8595437b6d736A0ffdCcf9Fc',
      '0x35c123D458Cec42cba1a798ED01AC76bcC9C56c0',
      '0xE755Cb282F2B872Cbb9dCcbd736Eb508bda861A2',
      '0x0d2A4EF4aeB9680b57eE4Eb13279C2Be439A6120',
      '0xf0792d7ff5d5dD044aF197D78caADb235e3b3479',
    ];
    

    let owner = accounts[0];
    let firstAirline = accounts[1];

    let flightSuretyData = await FlightSuretyData.new();
    let flightSuretyApp = await FlightSuretyApp.new();


    let sleep = async (milliseconds) => {
      await new Promise((resolve) => {
        return setTimeout(resolve, milliseconds);
      });
    };

    return {
        owner: owner,
        firstAirline: firstAirline,
        weiMultiple: (new BigNumber(10)).pow(18),
        testAddresses: testAddresses,
        flightSuretyData: flightSuretyData,
        flightSuretyApp: flightSuretyApp,
        sleep: sleep
    }
}

module.exports = {
    Config: Config
};