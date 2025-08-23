import { parseAbi } from 'viem';
import { describe, expect, it } from 'vitest';

import { generateEventHandlers } from '../../../src/lib/envio/generateEventHandlers.js';
import type { ZonderConfig } from '../../../src/lib/zonder/types.js';

describe('generateEventHandlers', () => {
  it('should generate event handlers for single contract', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        EVault: parseAbi([
          'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
          'event Borrow(address indexed account, uint256 assets)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const handlers = generateEventHandlers(config);

    // Check imports
    expect(handlers).toContain('import { EVault, EventLog } from "generated"');

    // Check helper functions
    expect(handlers).toContain('function extractEventParams');
    expect(handlers).toContain('export function registerHandler');

    // Check contract registration
    expect(handlers).toContain('Object.entries(EVault).forEach');
    expect(handlers).toContain('registerHandler(handler, "EVault", eventName)');
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
    expect(handlers).toContain('import { TokenA, TokenB, Oracle, EventLog } from "generated"');

    // Check registrations for each contract
    expect(handlers).toContain('Object.entries(TokenA).forEach');
    expect(handlers).toContain('registerHandler(handler, "TokenA", eventName)');

    expect(handlers).toContain('Object.entries(TokenB).forEach');
    expect(handlers).toContain('registerHandler(handler, "TokenB", eventName)');

    expect(handlers).toContain('Object.entries(Oracle).forEach');
    expect(handlers).toContain('registerHandler(handler, "Oracle", eventName)');
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

    // Check extractEventParams function
    expect(handlers).toContain(
      'const id = `${event.chainId}_${event.block.number}_${event.logIndex}`',
    );
    expect(handlers).toContain('chainId: event.chainId');
    expect(handlers).toContain('txHash: event.transaction');
    expect(handlers).toContain('blockNumber: BigInt(event.block.number)');
    expect(handlers).toContain('timestamp: BigInt(event.block.timestamp)');
    expect(handlers).toContain('logIndex: event.logIndex');
    expect(handlers).toContain('logAddress: event.srcAddress');
    expect(handlers).toContain('acc[`evt_${key}`] = value');

    // Check registerHandler function
    expect(handlers).toContain('const contextKey = `${contractName}_${eventName}`');
    expect(handlers).toContain('context[contextKey].set(extractEventParams(event))');
  });
});
