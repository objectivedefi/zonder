import { Address, parseAbiItem } from 'viem';
import { arbitrum, mainnet } from 'viem/chains';
import { describe, expect, it } from 'vitest';

import { zonder } from '../src/lib/zonder';
import { addrA, addrB } from './utils';

describe('zonder configuration', () => {
  const mockAbi = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
  ] as const;

  const validConfig = {
    chains: { mainnet, arbitrum },
    contracts: { Token: mockAbi },
    addresses: {
      mainnet: { Token: addrA },
      arbitrum: { Token: addrB },
    },
    startBlocks: {
      mainnet: 1000000,
      arbitrum: 2000000,
    },
  } as const;

  describe('validation', () => {
    it('should accept valid configuration', () => {
      expect(() => zonder(validConfig)).not.toThrow();
    });

    it('should validate chain references in addresses', () => {
      const invalidConfig = {
        ...validConfig,
        addresses: {
          ...validConfig.addresses,
          invalidChain: { Token: addrA },
        },
      };

      expect(() => zonder(invalidConfig)).toThrow(
        'Chain "invalidChain" in addresses is not defined in chains',
      );
    });

    it('should validate contract references in addresses', () => {
      const invalidConfig = {
        ...validConfig,
        addresses: {
          mainnet: {
            InvalidContract: addrA,
          } as any,
          arbitrum: validConfig.addresses.arbitrum,
        },
      } as any;

      expect(() => zonder(invalidConfig)).toThrow(
        'Contract "InvalidContract" in addresses is not defined in contracts',
      );
    });

    it('should validate Ethereum addresses', () => {
      const invalidConfig = {
        ...validConfig,
        addresses: {
          mainnet: { Token: 'not-an-address' as any },
          arbitrum: validConfig.addresses.arbitrum,
        },
      };

      expect(() => zonder(invalidConfig)).toThrow('Invalid address "not-an-address"');
    });

    it('should validate factory deployedBy references', () => {
      const configWithFactory = {
        ...validConfig,
        contracts: {
          Token: mockAbi,
          Factory: mockAbi,
        },
        factoryDeployed: {
          Token: {
            event: parseAbiItem('event Created(address indexed proxy)'),
            parameter: 'proxy',
            deployedBy: 'NonExistentFactory' as any,
          },
        },
      };

      expect(() => zonder(configWithFactory)).toThrow(
        'Factory "NonExistentFactory" referenced by "Token" is not defined in contracts',
      );
    });

    it('should handle array of addresses', () => {
      const configWithArrays = {
        ...validConfig,
        addresses: {
          mainnet: {
            Token: [addrA, addrB] as Address[],
          },
          arbitrum: validConfig.addresses.arbitrum,
        },
      };

      expect(() => zonder(configWithArrays)).not.toThrow();
    });
  });

  describe('type inference', () => {
    it('should infer chain types correctly', () => {
      const config = zonder(validConfig);

      // TypeScript should infer these types
      type ChainKeys = keyof typeof config.chains;
      const chainTest: ChainKeys = 'mainnet'; // Should compile
      expect(chainTest).toBe('mainnet');
    });

    it('should infer contract types correctly', () => {
      const config = zonder(validConfig);

      // TypeScript should infer these types
      type ContractKeys = keyof typeof config.contracts;
      const contractTest: ContractKeys = 'Token'; // Should compile
      expect(contractTest).toBe('Token');
    });
  });
});
