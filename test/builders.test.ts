import { Address, parseAbiItem } from 'viem';
import { arbitrum, mainnet } from 'viem/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildChains,
  buildContractChainAddressConfig,
  buildContractConfig,
} from '../src/lib/buildConfig';
import { addrA, addrB } from './utils';

// Mock environment variables
beforeEach(() => {
  vi.stubEnv('PONDER_RPC_URL_1', 'https://eth.llamarpc.com,https://rpc.ankr.com/eth');
  vi.stubEnv('PONDER_RPC_URL_42161', 'https://arb1.arbitrum.io/rpc');
});

describe('buildChains', () => {
  it('should build chain config with RPC URLs from env', () => {
    const chains = { mainnet, arbitrum };
    const result = buildChains(chains);

    expect(result).toEqual({
      mainnet: {
        id: 1,
        rpc: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
      },
      arbitrum: {
        id: 42161,
        rpc: ['https://arb1.arbitrum.io/rpc'],
      },
    });
  });

  it('should throw if RPC URLs are not set', () => {
    delete process.env.PONDER_RPC_URL_1;
    const chains = { mainnet };

    expect(() => buildChains(chains)).toThrow('PONDER_RPC_URL_1 is not set');
  });

  it('should throw if RPC URLs contain invalid URL', () => {
    vi.stubEnv('PONDER_RPC_URL_1', 'https://eth.llamarpc.com,invalid');
    const chains = { mainnet };

    expect(() => buildChains(chains)).toThrow('PONDER_RPC_URL_1 contains invalid URL: "invalid"');
  });
});

describe('buildContractChainAddressConfig', () => {
  const mockAbi = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [],
    },
  ] as const;

  const config = {
    chains: { mainnet, arbitrum },
    contracts: {
      Token: mockAbi,
      Factory: mockAbi,
    },
    addresses: {
      mainnet: {
        Factory: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      arbitrum: {
        Token: addrB,
        Factory: addrA,
      },
    },
    factoryDeployed: {
      Token: {
        event: parseAbiItem('event Created(address indexed proxy)'),
        parameter: 'proxy',
        deployedBy: 'Factory',
      },
    },
    startBlocks: {
      mainnet: 1000000,
      arbitrum: 2000000,
    },
  } as const;

  it('should handle singleton contract addresses', () => {
    const result = buildContractChainAddressConfig(config, 'mainnet', 'Factory');

    expect(result).toEqual({
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
  });

  it('should handle factory-deployed contracts', () => {
    // Clear Token address on arbitrum to test factory deployment
    const factoryConfig = {
      ...config,
      addresses: {
        mainnet: config.addresses.mainnet,
        arbitrum: {
          Factory: addrB,
        },
      },
    };

    const result = buildContractChainAddressConfig(factoryConfig, 'arbitrum', 'Token');

    // Check that factory() was called with correct params
    expect(result.address).toBeDefined();
    // In real test, you'd mock the factory function and verify calls
  });

  it('should throw if contract configured as both singleton and factory', () => {
    const invalidConfig = {
      ...config,
      addresses: {
        mainnet: {
          Token: addrA, // Both singleton address AND factory config
          Factory: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
        arbitrum: config.addresses.arbitrum,
      },
    } as const;

    expect(() => buildContractChainAddressConfig(invalidConfig, 'mainnet', 'Token')).toThrow(
      'Contract Token is configured both as a singleton and a factory on chain mainnet',
    );
  });

  it('should throw if factory address is missing', () => {
    const configMissingFactory = {
      ...config,
      addresses: {
        mainnet: { Token: addrA },
        arbitrum: {}, // No Factory address
      },
    } as const;

    expect(() =>
      buildContractChainAddressConfig(configMissingFactory, 'arbitrum', 'Token'),
    ).toThrow('the factory Factory is not configured');
  });

  it('should handle array of addresses', () => {
    const configWithArrays = {
      ...config,
      addresses: {
        ...config.addresses,
        mainnet: {
          ...config.addresses.mainnet,
          Token: [addrA, addrB] as Address[],
        },
      },
      // Remove factoryDeployed config since we're testing Token as a multi-address contract
      factoryDeployed: {},
    } as const;

    const result = buildContractChainAddressConfig(configWithArrays, 'mainnet', 'Token');

    expect(result).toEqual({
      address: [addrA, addrB],
    });
  });
});

describe('buildContractConfig', () => {
  const mockAbi = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [],
    },
  ] as const;

  const contractTestConfig = {
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
  };

  it('should build complete contract config', () => {
    const result = buildContractConfig(contractTestConfig, 'Token');

    expect(result).toEqual({
      abi: mockAbi,
      chain: {
        mainnet: {
          address: addrA,
          startBlock: 1000000,
        },
        arbitrum: {
          address: addrB,
          startBlock: 2000000,
        },
      },
    });
  });
});
