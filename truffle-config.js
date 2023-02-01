const HDWalletProvider = require('@truffle/hdwallet-provider');
const mnemonic =
  'perfect celery short patch promote island major place lab submit fence sort';

module.exports = {
  networks: {
    development: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: {
            phrase: mnemonic,
          },
          providerOrUrl: 'http://127.0.0.1:8545',
          addressIndex: 0,
          numberOfAddresses: 50,
        }),
      network_id: '*',
    },
  },
  compilers: {
    solc: {
      version: '0.8.4',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
