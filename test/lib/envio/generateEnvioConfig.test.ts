import * as yaml from 'js-yaml';
import { type Address, parseAbi } from 'viem';
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

    // ERC20 should still be there with address
    expect(mainnetSection).toContain('name: ERC20');
    expect(mainnetSection).toMatch(/name:\s*ERC20[\s\S]*?address:/);

    // UniswapV2Pair should be there but WITHOUT address (factory-deployed)
    expect(mainnetSection).toContain('name: UniswapV2Pair');
    expect(mainnetSection).not.toMatch(/name:\s*UniswapV2Pair[\s\S]*?address:/);

    // UniswapV2Pair should also be in the contracts section for registration methods
    expect(yamlContent).toContain('name: UniswapV2Pair');
  });

  it('should NOT include factory-deployed contracts without events', () => {
    const configWithFactoryNoEvents: ZonderConfig<any, any> = {
      chains: { mainnet },
      contracts: {
        Factory: parseAbi([
          'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
        ]),
        // Factory-deployed contract with no events defined in ABI
        DeployedContract: parseAbi(['function someFunction() view returns (uint256)']),
      },
      addresses: {
        mainnet: {
          Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address,
          // No address for DeployedContract since it's factory-deployed
        },
      },
      factoryDeployed: {
        DeployedContract: {
          event: parseAbi([
            'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
          ])[0],
          parameter: 'pair',
          deployedBy: 'Factory' as any,
        },
      },
    };

    const yamlContent = generateEnvioConfig(configWithFactoryNoEvents);

    // Factory should be in contracts (has events)
    expect(yamlContent).toContain('name: Factory');

    // DeployedContract should NOT be in contracts (no events, so useless to index)
    expect(yamlContent).not.toContain('name: DeployedContract');
  });

  it('should include events from factory-deployed contracts with events in their ABI', () => {
    const configWithFactoryEvents: ZonderConfig<any, any> = {
      chains: { mainnet },
      contracts: {
        Factory: parseAbi([
          'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
        ]),
        // Factory-deployed contract WITH events in its ABI
        DeployedWithEvents: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
          'event Approval(address indexed owner, address indexed spender, uint256 value)',
        ]),
      },
      addresses: {
        mainnet: {
          Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address,
        },
      },
      factoryDeployed: {
        DeployedWithEvents: {
          event: parseAbi([
            'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
          ])[0],
          parameter: 'pair',
          deployedBy: 'Factory' as any,
        },
      },
    };

    const yamlContent = generateEnvioConfig(configWithFactoryEvents);

    // DeployedWithEvents should be in contracts section
    expect(yamlContent).toContain('name: DeployedWithEvents');

    // DeployedWithEvents should include its own events from the ABI
    expect(yamlContent).toContain(
      'event: Transfer(address indexed from, address indexed to, uint256 value)',
    );
    expect(yamlContent).toContain(
      'event: Approval(address indexed owner, address indexed spender, uint256 value)',
    );

    // Should NOT have empty events array
    expect(yamlContent).not.toMatch(/name:\s+DeployedWithEvents[\s\S]*?events:\s*\[\s*\]/);
  });

  it('should reproduce IRMLinearKink scenario with factory-deployed contracts', () => {
    const irmConfig: ZonderConfig<any, any> = {
      chains: { mainnet },
      contracts: {
        IRMLinearKinkFactory: parseAbi([
          'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
        ]),
        // This simulates IRMLinearKink with events like Transfer, etc.
        IRMLinearKink: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
          'event InterestRateUpdated(uint256 baseRate, uint256 multiplier)',
        ]),
      },
      addresses: {
        mainnet: {
          IRMLinearKinkFactory: '0x123...' as Address,
          // No address for IRMLinearKink since it's factory-deployed
        },
      },
      factoryDeployed: {
        IRMLinearKink: {
          event: parseAbi([
            'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
          ])[0],
          parameter: 'proxy',
          deployedBy: 'IRMLinearKinkFactory' as any,
        },
      },
    };

    const yamlContent = generateEnvioConfig(irmConfig);

    // IRMLinearKink should be in contracts section
    expect(yamlContent).toContain('name: IRMLinearKink');

    // IRMLinearKink should include its own events from the ABI, not an empty array
    expect(yamlContent).toContain(
      'event: Transfer(address indexed from, address indexed to, uint256 value)',
    );
    expect(yamlContent).toContain(
      'event: InterestRateUpdated(uint256 baseRate, uint256 multiplier)',
    );

    // Should NOT have empty events array
    expect(yamlContent).not.toMatch(/name:\s+IRMLinearKink[\s\S]*?events:\s*\[\s*\]/);

    // Should be in network contracts but WITHOUT address
    const lines = yamlContent.split('\n');
    const networksIdx = lines.findIndex((line) => line.includes('networks:'));
    const networksSection = lines.slice(networksIdx).join('\n');

    // Should be listed in networks.contracts
    expect(networksSection).toContain('name: IRMLinearKink');
    // But should NOT have address field
    expect(networksSection).not.toMatch(/name:\s*IRMLinearKink\s+address:/);
  });

  it('should NOT include factory-deployed contracts with no events in config', () => {
    const configWithFactoryNoEvents: ZonderConfig<any, any> = {
      chains: { mainnet },
      contracts: {
        Factory: parseAbi([
          'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
        ]),
        // Factory-deployed contract with NO events - only functions
        ContractWithNoEvents: parseAbi([
          'function someFunction() view returns (uint256)',
          'function anotherFunction() external',
        ]),
      },
      addresses: {
        mainnet: {
          Factory: '0x123...' as Address,
        },
      },
      factoryDeployed: {
        ContractWithNoEvents: {
          event: parseAbi([
            'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
          ])[0],
          parameter: 'proxy',
          deployedBy: 'Factory' as any,
        },
      },
    };

    const yamlContent = generateEnvioConfig(configWithFactoryNoEvents);

    // Factory should be in contracts (has events)
    expect(yamlContent).toContain('name: Factory');

    // ContractWithNoEvents should NOT be in contracts section since it has no events
    expect(yamlContent).not.toContain('name: ContractWithNoEvents');
  });

  it('should handle complete factory deployment scenario correctly', () => {
    const completeConfig: ZonderConfig<any, any> = {
      chains: { mainnet },
      contracts: {
        // Factory contract with events
        MyFactory: parseAbi([
          'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
        ]),
        // Factory-deployed contract WITH events
        TokenWithEvents: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ]),
        // Factory-deployed contract WITHOUT events (should be ignored)
        TokenWithoutEvents: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
        // Regular contract with events and address
        RegularContract: parseAbi(['event SomeEvent(uint256 value)']),
      },
      addresses: {
        mainnet: {
          MyFactory: '0xFactory123' as Address,
          RegularContract: '0xRegular123' as Address,
          // No addresses for factory-deployed contracts
        },
      },
      factoryDeployed: {
        TokenWithEvents: {
          event: parseAbi([
            'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
          ])[0],
          parameter: 'proxy',
          deployedBy: 'MyFactory' as any,
        },
        TokenWithoutEvents: {
          event: parseAbi([
            'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
          ])[0],
          parameter: 'proxy',
          deployedBy: 'MyFactory' as any,
        },
      },
    };

    const yamlContent = generateEnvioConfig(completeConfig);

    // Contracts section should include:
    expect(yamlContent).toContain('name: MyFactory'); // Factory (has events)
    expect(yamlContent).toContain('name: TokenWithEvents'); // Factory-deployed with events
    expect(yamlContent).toContain('name: RegularContract'); // Regular contract
    expect(yamlContent).not.toContain('name: TokenWithoutEvents'); // Factory-deployed without events

    // Networks section analysis
    const lines = yamlContent.split('\n');
    const networksIdx = lines.findIndex((line) => line.includes('networks:'));
    const networksSection = lines.slice(networksIdx).join('\n');

    // Should have MyFactory with address
    expect(networksSection).toMatch(/name:\s*MyFactory[\s\S]*?address:/);

    // Should have RegularContract with address
    expect(networksSection).toMatch(/name:\s*RegularContract[\s\S]*?address:/);

    // Should have TokenWithEvents WITHOUT address (factory-deployed)
    expect(networksSection).toContain('name: TokenWithEvents');
    expect(networksSection).not.toMatch(/name:\s*TokenWithEvents[\s\S]*?address:/);

    // Should NOT have TokenWithoutEvents at all
    expect(networksSection).not.toContain('name: TokenWithoutEvents');
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

  it('should include all contracts with events in every network, even without addresses', async () => {
    const config: ZonderConfig<any, any> = {
      chains: {
        mainnet,
        optimism: { id: 10, name: 'optimism' } as any,
      },
      contracts: {
        TokenFactory: parseAbi([
          'event TokenCreated(address indexed token, address indexed creator)',
        ]),
        Token: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ]),
        UniswapPool: parseAbi([
          'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1)',
        ]),
        // Contract with no events should not be included
        NoEventsContract: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
      },
      addresses: {
        mainnet: {
          TokenFactory: '0x1234567890123456789012345678901234567890',
          // Token has no address (factory-deployed)
          // UniswapPool has no address (needs to be discovered)
        },
        optimism: {
          TokenFactory: '0x1234567890123456789012345678901234567890',
        },
      },
      factoryDeployed: {
        Token: {
          event: parseAbi([
            'event TokenCreated(address indexed token, address indexed creator)',
          ])[0],
          parameter: 'token',
          deployedBy: 'TokenFactory' as any,
        },
      },
    };

    const yamlContent = await generateEnvioConfig(config);
    const parsedYaml = yaml.load(yamlContent) as any;

    // Check mainnet network includes all contracts with events
    const mainnetNetwork = parsedYaml.networks.find((n: any) => n.id === 1);
    expect(mainnetNetwork).toBeDefined();
    expect(mainnetNetwork.contracts).toHaveLength(3); // TokenFactory, Token, UniswapPool (not NoEventsContract)

    const mainnetContractNames = mainnetNetwork.contracts.map((c: any) => c.name);
    expect(mainnetContractNames).toContain('TokenFactory');
    expect(mainnetContractNames).toContain('Token');
    expect(mainnetContractNames).toContain('UniswapPool');
    expect(mainnetContractNames).not.toContain('NoEventsContract');

    // TokenFactory should have address
    const mainnetTokenFactory = mainnetNetwork.contracts.find(
      (c: any) => c.name === 'TokenFactory',
    );
    expect(mainnetTokenFactory.address).toBeDefined();

    // Token and UniswapPool should NOT have address
    const mainnetToken = mainnetNetwork.contracts.find((c: any) => c.name === 'Token');
    expect(mainnetToken.address).toBeUndefined();

    const mainnetUniswap = mainnetNetwork.contracts.find((c: any) => c.name === 'UniswapPool');
    expect(mainnetUniswap.address).toBeUndefined();

    // Check optimism network also includes all contracts with events
    const optimismNetwork = parsedYaml.networks.find((n: any) => n.id === 10);
    expect(optimismNetwork).toBeDefined();
    expect(optimismNetwork.contracts).toHaveLength(3);

    const optimismContractNames = optimismNetwork.contracts.map((c: any) => c.name);
    expect(optimismContractNames).toContain('TokenFactory');
    expect(optimismContractNames).toContain('Token');
    expect(optimismContractNames).toContain('UniswapPool');
  });
});
