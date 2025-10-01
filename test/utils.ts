import { Address, parseAbi } from 'viem';

export const addrA: Address = '0x6a34a37a95E79525b9d0a3BF0c599c5A6d71B4Ce';
export const addrB: Address = '0x2a34a37A95E79525b9D0a3BF0c599c5A6D71B4ce';

export const simpleConfig = {
  chains: { mainnet: { id: 1, rpcUrl: 'https://eth.llamarpc.com' } },
  contracts: {
    Greeter: parseAbi([
      'event GreetingChange(string indexed oldGreeting, string indexed newGreeting, address indexed greeter)',
    ]),
  },
  addresses: {
    mainnet: {
      Greeter: addrA,
    },
  },
};
