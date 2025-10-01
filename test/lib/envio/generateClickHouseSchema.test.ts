import { describe, expect, it } from 'vitest';

import { generateClickHouseSchema } from '../../../src/lib/envio/generateClickHouseSchema';
import { addrA, simpleConfig } from '../../utils';

describe('generateClickHouseSchema', () => {
  it('generates schema with database creation', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('CREATE DATABASE IF NOT EXISTS test_db');
  });

  it('generates tables with snake_case names', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    // Should convert PascalCase to snake_case
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS test_db.greeter_greeting_change');
  });

  it('includes common event fields', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('id String');
    expect(schema).toContain('chain_id UInt32');
    expect(schema).toContain('tx_hash FixedString(66)');
    expect(schema).toContain('block_number UInt64');
    expect(schema).toContain('block_timestamp DateTime');
    expect(schema).toContain('log_index UInt32');
    expect(schema).toContain('log_address FixedString(42)');
    expect(schema).toContain('_inserted_at DateTime DEFAULT now()');
  });

  it('includes event-specific fields with evt_ prefix', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    // GreetingChange event has: oldGreeting, newGreeting, greeter (camelCase preserved in schema)
    expect(schema).toContain('evt_oldGreeting String');
    expect(schema).toContain('evt_newGreeting String');
    expect(schema).toContain('evt_greeter FixedString(42)');
  });

  it('uses ReplacingMergeTree engine', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('ENGINE = ReplacingMergeTree(_inserted_at)');
  });

  it('partitions by month', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('PARTITION BY toYYYYMM(block_timestamp)');
  });

  it('orders by id', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('ORDER BY (id)');
  });

  it('maps address type to FixedString(42)', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('evt_greeter FixedString(42)');
  });

  it('maps string type to String', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('evt_oldGreeting String');
    expect(schema).toContain('evt_newGreeting String');
  });

  it('maps uint256 to UInt256', () => {
    const configWithUint = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'Transfer',
            inputs: [{ name: 'amount', type: 'uint256', indexed: false }],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithUint, 'test_db');
    expect(schema).toContain('evt_amount UInt256');
  });

  it('maps int256 to Int256', () => {
    const configWithInt = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'PriceUpdate',
            inputs: [{ name: 'delta', type: 'int256', indexed: false }],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithInt, 'test_db');
    expect(schema).toContain('evt_delta Int256');
  });

  it('rounds up integer sizes to nearest supported size', () => {
    const configWithSmallInts = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'Test',
            inputs: [
              { name: 'u48', type: 'uint48', indexed: false },
              { name: 'i24', type: 'int24', indexed: false },
            ],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithSmallInts, 'test_db');
    // uint48 should round up to UInt64
    expect(schema).toContain('evt_u48 UInt64');
    // int24 should round up to Int32
    expect(schema).toContain('evt_i24 Int32');
  });

  it('maps bool to Bool', () => {
    const configWithBool = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'StatusUpdate',
            inputs: [{ name: 'active', type: 'bool', indexed: false }],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithBool, 'test_db');
    expect(schema).toContain('evt_active Bool');
  });

  it('maps bytes32 to FixedString with correct length', () => {
    const configWithBytes = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'HashUpdate',
            inputs: [{ name: 'hash', type: 'bytes32', indexed: false }],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithBytes, 'test_db');
    // bytes32 = 2 + (32 * 2) = 66 chars
    expect(schema).toContain('evt_hash FixedString(66)');
  });

  it('maps dynamic bytes to String', () => {
    const configWithDynamicBytes = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'DataUpdate',
            inputs: [{ name: 'data', type: 'bytes', indexed: false }],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithDynamicBytes, 'test_db');
    expect(schema).toContain('evt_data String');
  });

  it('maps arrays to Array(T)', () => {
    const configWithArray = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'BatchUpdate',
            inputs: [{ name: 'addresses', type: 'address[]', indexed: false }],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithArray, 'test_db');
    expect(schema).toContain('evt_addresses Array(FixedString(42))');
  });

  it('maps tuples to JSON', () => {
    const configWithTuple = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'ComplexUpdate',
            inputs: [
              {
                name: 'data',
                type: 'tuple',
                indexed: false,
                components: [
                  { name: 'value', type: 'uint256' },
                  { name: 'timestamp', type: 'uint256' },
                ],
              },
            ],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithTuple, 'test_db');
    expect(schema).toContain('evt_data JSON');
  });

  it('handles unnamed parameters with param_ prefix', () => {
    const configWithUnnamed = {
      ...simpleConfig,
      contracts: {
        TestContract: [
          {
            type: 'event',
            name: 'AnonymousParams',
            inputs: [
              { name: '', type: 'uint256', indexed: false },
              { name: '', type: 'address', indexed: false },
            ],
          },
        ] as const,
      },
    };

    const schema = generateClickHouseSchema(configWithUnnamed, 'test_db');
    expect(schema).toContain('evt_param_0 UInt256');
    expect(schema).toContain('evt_param_1 FixedString(42)');
  });

  it('generates multiple tables for multiple contracts', () => {
    const multiContractConfig = {
      chains: { mainnet: { id: 1, rpcUrl: 'https://eth.llamarpc.com' } },
      contracts: {
        Token: [
          {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { name: 'from', type: 'address', indexed: true },
              { name: 'to', type: 'address', indexed: true },
              { name: 'value', type: 'uint256', indexed: false },
            ],
          },
        ] as const,
        Vault: [
          {
            type: 'event',
            name: 'Deposit',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
            ],
          },
        ] as const,
      },
      addresses: {
        mainnet: {
          Token: '0x1234567890123456789012345678901234567890',
          Vault: '0x0987654321098765432109876543210987654321',
        },
      },
    };

    const schema = generateClickHouseSchema(multiContractConfig, 'test_db');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS test_db.token_transfer');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS test_db.vault_deposit');
  });

  it('uses default database when not specified', () => {
    const schema = generateClickHouseSchema(simpleConfig);

    expect(schema).toContain('CREATE DATABASE IF NOT EXISTS default');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS default.greeter_greeting_change');
  });

  it('includes header comments', () => {
    const schema = generateClickHouseSchema(simpleConfig, 'test_db');

    expect(schema).toContain('-- ClickHouse Schema for Zonder-generated Indexer');
    expect(schema).toContain('-- Auto-generated - DO NOT EDIT MANUALLY');
    expect(schema).toContain('-- Database: test_db');
    expect(schema).toContain('-- Tables use ReplacingMergeTree for automatic deduplication');
    expect(schema).toContain('-- Monthly partitioning by block_timestamp for time-series queries');
  });

  it('skips contracts with no events', () => {
    const configNoEvents = {
      chains: { mainnet: { id: 1, rpcUrl: 'https://eth.llamarpc.com' } },
      contracts: {
        NoEvents: [] as const,
      },
      addresses: {
        mainnet: {
          NoEvents: addrA,
        },
      },
    };

    const schema = generateClickHouseSchema(configNoEvents, 'test_db');

    expect(schema).not.toContain('no_events');
  });
});
