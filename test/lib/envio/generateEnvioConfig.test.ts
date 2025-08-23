import { parseAbi } from 'viem';
import { arbitrum, mainnet } from 'viem/chains';
import { describe, expect, it } from 'vitest';

import { generateEnvioConfig } from '../../../src/lib/envio/generateEnvioConfig.js';
import type { ZonderConfig } from '../../../src/lib/zonder/types.js';

describe('generateEnvioConfig', () => {
  const testConfig: ZonderConfig<any, any> = {
    chains: {
      mainnet,
      arbitrum,
    },
    contracts: {
      ERC20: parseAbi([
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event Approval(address indexed owner, address indexed spender, uint256 value)',
      ]),
      UniswapV2Pair: parseAbi([
        'event Sync(uint112 reserve0, uint112 reserve1)',
        'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
      ]),
    },
    addresses: {
      mainnet: {
        ERC20: [
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        ],
        UniswapV2Pair: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
      },
      arbitrum: {
        ERC20: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        UniswapV2Pair: '0x09c3d8547a9d7a00f2ee87584d41c8ba7797cf08',
      },
    },
    startBlocks: {
      mainnet: {
        default: 12000000,
        ERC20: 11000000,
      },
      arbitrum: {
        default: 1000000,
      },
    },
  };

  it('should generate valid Envio YAML configuration', async () => {
    const yamlContent = await generateEnvioConfig(testConfig, 'test-indexer');

    expect(yamlContent).toContain('name: test-indexer');
    expect(yamlContent).toContain('description: Auto-generated Envio configuration from Zonder');
    expect(yamlContent).toContain('unordered_multichain_mode: true');
  });

  it('should include all contracts with correct ABI paths', async () => {
    const yamlContent = await generateEnvioConfig(testConfig);

    expect(yamlContent).toContain('name: ERC20');
    expect(yamlContent).toContain('handler: ./src/EventHandlers.ts');

    expect(yamlContent).toContain('name: UniswapV2Pair');
    expect(yamlContent).toContain('handler: ./src/EventHandlers.ts');
  });

  it('should generate correct event signatures', async () => {
    const yamlContent = await generateEnvioConfig(testConfig);

    // Event signatures should include full format with indexed keywords and parameter names
    expect(yamlContent).toContain(
      'event: Transfer(address indexed from, address indexed to, uint256 value)',
    );
    expect(yamlContent).toContain(
      'event: Approval(address indexed owner, address indexed spender, uint256 value)',
    );
    expect(yamlContent).toContain('event: Sync(uint112 reserve0, uint112 reserve1)');
    expect(yamlContent).toContain(
      'event: Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
    );
  });

  it('should configure networks with correct chain IDs', async () => {
    const yamlContent = await generateEnvioConfig(testConfig);

    expect(yamlContent).toContain('id: 1'); // mainnet
    expect(yamlContent).toContain('id: 42161'); // arbitrum
  });

  it('should handle multiple addresses for a contract', async () => {
    const yamlContent = await generateEnvioConfig(testConfig);

    // Check that mainnet ERC20 has multiple addresses
    const lines = yamlContent.split('\n');
    const erc20Index = lines.findIndex((line) => line.includes('name: ERC20'));
    const addressIndex = lines.findIndex((line, i) => i > erc20Index && line.includes('address:'));

    expect(lines[addressIndex + 1]).toContain('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(lines[addressIndex + 2]).toContain('0xdAC17F958D2ee523a2206206994597C13D831ec7');
  });

  it('should use custom start blocks when provided', async () => {
    const yamlContent = await generateEnvioConfig(testConfig);

    // Mainnet should have default start_block of 12000000
    expect(yamlContent).toMatch(/start_block: 12000000/);

    // Arbitrum should have default start_block of 1000000
    expect(yamlContent).toMatch(/start_block: 1000000/);
  });

  it('should handle factory-deployed contracts', async () => {
    const configWithFactory: ZonderConfig<any, any> = {
      ...testConfig,
      factoryDeployed: {
        UniswapV2Pair: {
          event: parseAbi([
            'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
          ])[0],
          parameter: 'pair',
          deployedBy: 'UniswapV2Factory' as any,
        },
      },
    };

    const yamlContent = await generateEnvioConfig(configWithFactory);

    // Factory-deployed contracts should be in contracts section but not in network addresses
    expect(yamlContent).toContain('name: UniswapV2Pair');

    // Should NOT have UniswapV2Pair in mainnet's contracts with address
    const lines = yamlContent.split('\n');
    const mainnetIdx = lines.findIndex((line) => line.includes('id: 1'));
    const arbitrumIdx = lines.findIndex((line) => line.includes('id: 42161'));
    const mainnetSection = lines
      .slice(mainnetIdx, arbitrumIdx > mainnetIdx ? arbitrumIdx : undefined)
      .join('\n');

    // ERC20 should still be there, but not UniswapV2Pair
    expect(mainnetSection).toContain('name: ERC20');
    expect(mainnetSection).not.toContain('name: UniswapV2Pair');
  });

  it('should handle events with tuple parameters', async () => {
    const configWithTuples: ZonderConfig<any, any> = {
      chains: { mainnet },
      contracts: {
        ComplexContract: parseAbi([
          'event ComplexEvent((address user, uint256 amount) indexed data, bool flag)',
        ]),
      },
      addresses: {
        mainnet: {
          ComplexContract: '0x1234567890123456789012345678901234567890',
        },
      },
      startBlocks: {
        mainnet: { default: 1000000 },
      },
    };

    const yamlContent = await generateEnvioConfig(configWithTuples);

    // Should handle tuple types correctly in event signature
    expect(yamlContent).toContain('event: ComplexEvent((address,uint256) indexed data, bool flag)');
  });
});
