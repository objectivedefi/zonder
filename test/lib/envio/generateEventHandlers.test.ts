import { parseAbi } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { generateEventHandlers } from '../../../src/lib/envio/generateEventHandlers.js';
import type { ZonderConfig } from '../../../src/lib/zonder/types.js';

describe('generateEventHandlers', () => {
  it('should generate event handlers for single contract', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        EVault: parseAbi([
          'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
          'event Borrow(address indexed account, uint256 assetsValue)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const handlers = generateEventHandlers(config);

    // Check imports
    expect(handlers).toContain('import { EVault } from "generated"');

    // Check individual handler registrations
    expect(handlers).toContain('EVault.Deposit.handler(async ({ event, context }) => {');
    expect(handlers).toContain('EVault.Borrow.handler(async ({ event, context }) => {');

    // Check ClickHouse writes
    expect(handlers).toContain(
      'import { writeToClickHouse, serializeForClickHouse } from "./clickhouse.js"',
    );
    expect(handlers).toContain('await context.effect(writeToClickHouse');
    expect(handlers).toContain('table: "evault_deposit"');
    expect(handlers).toContain('data: serializeForClickHouse(eventData)');
    expect(handlers).toContain('if (!context.isPreload)');
    expect(handlers).toContain('// Write directly to ClickHouse (skip CDC)');

    // Check field mappings
    expect(handlers).toContain('evt_sender: event.params.sender');
    expect(handlers).toContain('evt_assets_value: event.params.assetsValue');
  });

  it('should generate handlers for multiple contracts', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TokenA: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ]),
        TokenB: parseAbi([
          'event Approval(address indexed owner, address indexed spender, uint256 value)',
        ]),
        Oracle: parseAbi(['event PriceUpdated(address indexed asset, uint256 price)']),
      },
      addresses: {},
      startBlocks: {},
    };

    const handlers = generateEventHandlers(config);

    // Check imports for all contracts
    expect(handlers).toContain('import { TokenA, TokenB, Oracle } from "generated"');

    // Check individual handler registrations
    expect(handlers).toContain('TokenA.Transfer.handler(async ({ event, context }) => {');
    expect(handlers).toContain('TokenB.Approval.handler(async ({ event, context }) => {');
    expect(handlers).toContain('Oracle.PriceUpdated.handler(async ({ event, context }) => {');

    // Check ClickHouse writes (no more PostgreSQL writes)
    expect(handlers).toContain('data: serializeForClickHouse(eventData)');
    expect(handlers).toContain('if (!context.isPreload)');
  });

  it('should handle contracts with no events', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        NoEvents: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
      },
      addresses: {},
      startBlocks: {},
    };

    const handlers = generateEventHandlers(config);

    // Should return empty string when no events
    expect(handlers).toBe('');
  });

  it('should include correct helper function logic', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        Test: parseAbi(['event TestEvent(uint256 value)']),
      },
      addresses: {},
      startBlocks: {},
    };

    const handlers = generateEventHandlers(config);

    // Check direct field assignments in handler
    expect(handlers).toContain('Test.TestEvent.handler(async ({ event, context }) => {');
    expect(handlers).toContain('const eventData = {');
    expect(handlers).toContain('id: `${event.chainId}_${event.block.number}_${event.logIndex}`');
    expect(handlers).toContain('chain_id: event.chainId');
    expect(handlers).toContain('tx_hash: event.transaction.hash');
    expect(handlers).toContain('block_number: BigInt(event.block.number)');
    expect(handlers).toContain('block_timestamp: BigInt(event.block.timestamp)');
    expect(handlers).toContain('log_index: event.logIndex');
    expect(handlers).toContain('log_address: event.srcAddress');
    expect(handlers).toContain('evt_value: event.params.value');
    expect(handlers).toContain('data: serializeForClickHouse(eventData)');
  });

  it('should generate factory contract registrations', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        Factory: parseAbi([
          'event PairCreated(address indexed token0, address indexed token1, address pair, uint256 timestamp)',
        ]),
        Pair: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']),
      },
      addresses: {},
      startBlocks: {},
      factoryDeployed: {
        Pair: {
          event: parseAbi([
            'event PairCreated(address indexed token0, address indexed token1, address pair, uint256 timestamp)',
          ])[0],
          parameter: 'pair',
          deployedBy: 'Factory' as any,
        },
      },
    };

    const handlers = generateEventHandlers(config);

    // Should include both contracts in imports
    expect(handlers).toContain('import { Factory, Pair } from "generated"');

    // Should include factory contract registration comment
    expect(handlers).toContain('// Factory contract registration for Pair');

    // Should include contractRegister handler
    expect(handlers).toContain('Factory.PairCreated.contractRegister(({ event, context }) => {');
    expect(handlers).toContain('const deployedAddress = event.params.pair;');
    expect(handlers).toContain('context.addPair(deployedAddress);');

    // Should still include regular event handlers for both contracts
    expect(handlers).toContain('Factory.PairCreated.handler(async ({ event, context }) => {');
    expect(handlers).toContain('Pair.Transfer.handler(async ({ event, context }) => {');
  });

  it('should handle config without factory contracts', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        Token: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ]),
      },
      addresses: {},
      startBlocks: {},
      // No factoryDeployed config
    };

    const handlers = generateEventHandlers(config);

    // Should not include any factory registration code
    expect(handlers).not.toContain('contractRegister');
    expect(handlers).not.toContain('Factory contract registration');

    // Should still work normally
    expect(handlers).toContain('import { Token } from "generated"');
    expect(handlers).toContain('Token.Transfer.handler(async ({ event, context }) => {');
  });

  it('should NOT generate registration for factory-deployed contracts with no events', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        Factory: parseAbi([
          'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
        ]),
        // Contract deployed by factory but with no events in its ABI
        DeployedContract: parseAbi(['function someFunction() view returns (uint256)']),
      },
      addresses: {},
      startBlocks: {},
      factoryDeployed: {
        DeployedContract: {
          event: parseAbi([
            'event ProxyCreated(address indexed proxy, bool upgradeable, address implementation, bytes trailingData)',
          ])[0],
          parameter: 'proxy',
          deployedBy: 'Factory' as any,
        },
      },
    };

    const handlers = generateEventHandlers(config);

    // Should include Factory in imports (has events)
    expect(handlers).toContain('import { Factory } from "generated"');

    // Should NOT include factory contract registration since DeployedContract has no events
    expect(handlers).not.toContain('// Factory contract registration for DeployedContract');
    expect(handlers).not.toContain('Factory.ProxyCreated.contractRegister');
    expect(handlers).not.toContain('context.addDeployedContract');

    // Should include regular event handlers only for Factory (DeployedContract has no events)
    expect(handlers).toContain('Factory.ProxyCreated.handler(async ({ event, context }) => {');
    expect(handlers).not.toContain('DeployedContract');
  });

  it('should throw error for events with missing parameter names', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TestContract: [
          {
            anonymous: false,
            inputs: [{ indexed: false, internalType: 'address', name: '', type: 'address' }],
            name: 'TestEvent',
            type: 'event',
          },
        ] as any,
      },
      addresses: {},
      startBlocks: {},
    };

    expect(() => generateEventHandlers(config)).toThrow(
      'Event parameter at index 0 in event "TestEvent" of contract "TestContract" is missing a name. All event parameters must have names.',
    );
  });

  it('should throw error for events with empty string parameter names', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TestContract: [
          {
            anonymous: false,
            inputs: [{ indexed: false, internalType: 'address', name: '   ', type: 'address' }],
            name: 'TestEvent',
            type: 'event',
          },
        ] as any,
      },
      addresses: {},
      startBlocks: {},
    };

    expect(() => generateEventHandlers(config)).toThrow(
      'Event parameter at index 0 in event "TestEvent" of contract "TestContract" is missing a name. All event parameters must have names.',
    );
  });

  it('should ignore anonymous events and log warning', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TestContract: [
          {
            anonymous: true,
            inputs: [{ indexed: false, internalType: 'address', name: 'user', type: 'address' }],
            name: 'AnonymousEvent',
            type: 'event',
          },
          {
            anonymous: false,
            inputs: [{ indexed: false, internalType: 'address', name: 'user', type: 'address' }],
            name: 'RegularEvent',
            type: 'event',
          },
        ] as any,
      },
      addresses: {},
      startBlocks: {},
    };

    const handlers = generateEventHandlers(config);

    // Should warn about anonymous event
    expect(consoleSpy).toHaveBeenCalledWith(
      '⚠️  Anonymous event "AnonymousEvent" in contract "TestContract" will be ignored. Anonymous events cannot be efficiently indexed.',
    );

    // Should only include the regular event, not the anonymous one
    expect(handlers).toContain('import { TestContract } from "generated"');
    expect(handlers).toContain('TestContract.RegularEvent.handler');
    expect(handlers).not.toContain('TestContract.AnonymousEvent.handler');
    expect(handlers).toContain('table: "testcontract_regularevent"');
    expect(handlers).not.toContain('testcontract_anonymousevent');

    consoleSpy.mockRestore();
  });
});
