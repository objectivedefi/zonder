import { arbitrum, mainnet, polygon } from 'viem/chains';
import { describe, expect, it } from 'vitest';

import { generatePonderEnvExample } from '../../../src/lib/ponder/generateEnvExample.js';
import type { ZonderConfig } from '../../../src/lib/zonder/types.js';

describe('generatePonderEnvExample', () => {
  const singleChainConfig: ZonderConfig<any, any> = {
    chains: {
      mainnet,
    },
    contracts: {},
    addresses: {},
    startBlocks: {},
  };

  const multiChainConfig: ZonderConfig<any, any> = {
    chains: {
      mainnet,
      arbitrum,
      polygon,
    },
    contracts: {},
    addresses: {},
    startBlocks: {},
  };

  it('should generate RPC URL for single chain', () => {
    const envContent = generatePonderEnvExample(singleChainConfig);

    // Should have RPC URL for mainnet (chain ID 1)
    expect(envContent).toContain('PONDER_RPC_URL_1=');

    // Should include DATABASE_URL section
    expect(envContent).toContain(
      '# (Optional) Postgres database URL. If not provided, SQLite will be used.',
    );
    expect(envContent).toContain('DATABASE_URL=');
  });

  it('should generate RPC URLs for multiple chains', () => {
    const envContent = generatePonderEnvExample(multiChainConfig);

    // Should have RPC URLs for all chains
    expect(envContent).toContain('PONDER_RPC_URL_1='); // mainnet
    expect(envContent).toContain('PONDER_RPC_URL_42161='); // arbitrum
    expect(envContent).toContain('PONDER_RPC_URL_137='); // polygon

    // Should include DATABASE_URL section
    expect(envContent).toContain(
      '# (Optional) Postgres database URL. If not provided, SQLite will be used.',
    );
    expect(envContent).toContain('DATABASE_URL=');
  });

  it('should handle chains without ID gracefully', () => {
    const configWithInvalidChain: ZonderConfig<any, any> = {
      chains: {
        mainnet,
        invalidChain: { name: 'Invalid' }, // No id property
      },
      contracts: {},
      addresses: {},
      startBlocks: {},
    };

    const envContent = generatePonderEnvExample(configWithInvalidChain);

    // Should only include valid chains
    expect(envContent).toContain('PONDER_RPC_URL_1='); // mainnet
    expect(envContent).not.toContain('PONDER_RPC_URL_undefined=');
  });

  it('should handle empty chains config', () => {
    const emptyConfig: ZonderConfig<any, any> = {
      chains: {},
      contracts: {},
      addresses: {},
      startBlocks: {},
    };

    const envContent = generatePonderEnvExample(emptyConfig);

    // Should still include DATABASE_URL section
    expect(envContent).toContain(
      '# (Optional) Postgres database URL. If not provided, SQLite will be used.',
    );
    expect(envContent).toContain('DATABASE_URL=');

    // Should not contain any RPC URLs
    expect(envContent).not.toContain('PONDER_RPC_URL_');
  });

  it('should have proper formatting', () => {
    const envContent = generatePonderEnvExample(multiChainConfig);

    const lines = envContent.split('\n');

    // Should start with RPC URLs, then have empty line, then comment, then DATABASE_URL
    expect(lines[0]).toBe('PONDER_RPC_URL_1=');
    expect(lines[1]).toBe('PONDER_RPC_URL_42161=');
    expect(lines[2]).toBe('PONDER_RPC_URL_137=');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe(
      '# (Optional) Postgres database URL. If not provided, SQLite will be used.',
    );
    expect(lines[5]).toBe('DATABASE_URL=');
  });

  it('should be deterministic for same config', () => {
    const content1 = generatePonderEnvExample(multiChainConfig);
    const content2 = generatePonderEnvExample(multiChainConfig);

    expect(content1).toBe(content2);
  });

  it('should handle custom chain IDs correctly', () => {
    const customChainConfig: ZonderConfig<any, any> = {
      chains: {
        customChain: { id: 999999, name: 'Custom Chain' },
        testnet: { id: 5, name: 'Goerli' },
      },
      contracts: {},
      addresses: {},
      startBlocks: {},
    };

    const envContent = generatePonderEnvExample(customChainConfig);

    expect(envContent).toContain('PONDER_RPC_URL_999999=');
    expect(envContent).toContain('PONDER_RPC_URL_5=');
  });
});
