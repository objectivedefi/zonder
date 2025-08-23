import { describe, expect, it } from 'vitest';

import { resolveStartBlock } from '../../../src/lib/zonder/resolveStartBlock';

describe('resolveStartBlock', () => {
  it('should return the default start block when contract not specified', () => {
    const startBlocks = {
      mainnet: {
        default: 1000000,
      },
      arbitrum: {
        default: 2000000,
      },
    };

    expect(resolveStartBlock(startBlocks, 'mainnet', 'SomeContract')).toBe(1000000);
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'AnotherContract')).toBe(2000000);
  });

  it('should return contract-specific start block when available', () => {
    const startBlocks = {
      mainnet: {
        Token: 1500000,
        Factory: 1600000,
        default: 1000000,
      },
      arbitrum: {
        Token: 2500000,
        default: 2000000,
      },
    };

    // Contract-specific blocks
    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(1500000);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'Factory')).toBe(1600000);
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'Token')).toBe(2500000);

    // Falls back to default when contract not specified
    expect(resolveStartBlock(startBlocks, 'mainnet', 'UnknownContract')).toBe(1000000);
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'Factory')).toBe(2000000);
  });

  it('should return 0 when chain is not configured', () => {
    const startBlocks = {
      mainnet: {
        default: 1000000,
      },
    };

    expect(resolveStartBlock(startBlocks, 'polygon', 'Token')).toBe(0);
  });

  it('should handle numeric values correctly', () => {
    const startBlocks = {
      mainnet: {
        Token: 0, // Edge case: block 0
        Factory: 999999999, // Large block number
        default: 100,
      },
    };

    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(0);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'Factory')).toBe(999999999);
  });

  it('should handle single-level start blocks (legacy format)', () => {
    const startBlocks = {
      mainnet: 1000000,
      arbitrum: 2000000,
    } as any;

    // This format now returns 0 as the ultimate fallback
    // since chainStartBlocks[contractName] is undefined and chainStartBlocks.default is undefined
    const result = resolveStartBlock(startBlocks, 'mainnet', 'Token');
    expect(result).toBe(0);
  });

  it('should prioritize contract-specific over default', () => {
    const startBlocks = {
      mainnet: {
        Token: 5000000,
        default: 1000000,
      },
    };

    // Should use Token-specific block, not default
    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(5000000);
  });

  it('should handle chains with only default value', () => {
    const startBlocks = {
      mainnet: {
        default: 1234567,
      },
    };

    expect(resolveStartBlock(startBlocks, 'mainnet', 'AnyContract')).toBe(1234567);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'AnotherContract')).toBe(1234567);
  });

  it('should handle mixed configuration', () => {
    const startBlocks = {
      // Chain with multiple contract-specific blocks
      mainnet: {
        TokenA: 1000000,
        TokenB: 1100000,
        TokenC: 1200000,
        default: 900000,
      },
      // Chain with only default
      arbitrum: {
        default: 2000000,
      },
      // Chain with one specific and default
      optimism: {
        TokenA: 3500000,
        default: 3000000,
      },
    };

    // Mainnet tests
    expect(resolveStartBlock(startBlocks, 'mainnet', 'TokenA')).toBe(1000000);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'TokenB')).toBe(1100000);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'TokenC')).toBe(1200000);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'TokenD')).toBe(900000);

    // Arbitrum tests (all use default)
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'TokenA')).toBe(2000000);
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'TokenB')).toBe(2000000);

    // Optimism tests
    expect(resolveStartBlock(startBlocks, 'optimism', 'TokenA')).toBe(3500000);
    expect(resolveStartBlock(startBlocks, 'optimism', 'TokenB')).toBe(3000000);
  });

  it('should return 0 when startBlocks is undefined', () => {
    const startBlocks = undefined;

    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(0);
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'Factory')).toBe(0);
  });

  it('should return 0 when default is not specified', () => {
    const startBlocks = {
      mainnet: {
        Token: 1500000,
        // No default specified
      },
    };

    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(1500000);
    expect(resolveStartBlock(startBlocks, 'mainnet', 'UnknownContract')).toBe(0);
  });

  it('should handle empty startBlocks object', () => {
    const startBlocks = {};

    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(0);
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'Factory')).toBe(0);
  });

  it('should handle chain with empty config', () => {
    const startBlocks = {
      mainnet: {},
    };

    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(0);
  });

  it('should prioritize contract-specific over default, with 0 as ultimate fallback', () => {
    const startBlocks = {
      mainnet: {
        Token: 5000000,
        // No default
      },
      arbitrum: {
        // No Token-specific, no default
      },
    };

    // Contract-specific value exists
    expect(resolveStartBlock(startBlocks, 'mainnet', 'Token')).toBe(5000000);
    // No contract-specific, no default, falls back to 0
    expect(resolveStartBlock(startBlocks, 'mainnet', 'Factory')).toBe(0);
    // Chain exists but empty, falls back to 0
    expect(resolveStartBlock(startBlocks, 'arbitrum', 'Token')).toBe(0);
  });
});
