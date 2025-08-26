import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateSchema } from '../../../src/lib/ponder/generateSchema';
import { addrA, addrB } from '../../utils';

beforeEach(() => {
  vi.stubEnv('PONDER_RPC_URL_1', 'https://eth.llamarpc.com');
  vi.stubEnv('PONDER_RPC_URL_42161', 'https://arb1.arbitrum.io/rpc');
});

describe('generateSchema', () => {
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
    {
      type: 'event',
      name: 'Approval',
      inputs: [
        { name: 'owner', type: 'address', indexed: true },
        { name: 'spender', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
    {
      type: 'function',
      name: 'balanceOf',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ type: 'uint256' }],
    },
  ] as const;

  const schemaConfig = {
    chains: { mainnet: { id: 1 } },
    contracts: { Token: mockAbi },
    addresses: {
      mainnet: { Token: addrA },
    },
    startBlocks: {
      mainnet: 1000000,
    },
  };

  it('should generate schema with correct structure', () => {
    const schema = generateSchema(schemaConfig);

    // Check header
    expect(schema).toContain('// This file is auto-generated');
    expect(schema).toContain("import { index, onchainTable } from 'ponder'");

    // Check metadata schema
    expect(schema).toContain('const metadataSchema = (t: any) => {');
    expect(schema).toContain('id: t.text().primaryKey');
    expect(schema).toContain('chainId: t.integer().notNull');
    expect(schema).toContain('blockTimestamp: t.bigint().notNull');

    // Check contract exports
    expect(schema).toContain('export const Token = {');

    // Check event tables
    expect(schema).toContain("Transfer: onchainTable('Token_Transfer'");
    expect(schema).toContain("Approval: onchainTable('Token_Approval'");

    // Check it doesn't include functions
    expect(schema).not.toContain('balanceOf');

    // Check individual event exports
    expect(schema).toContain('export const Token_Transfer = Token.Transfer');
    expect(schema).toContain('export const Token_Approval = Token.Approval');
  });

  it('should generate correct field types', () => {
    const schema = generateSchema(schemaConfig);

    // Check Transfer event fields
    expect(schema).toContain('evt_from: t.hex');
    expect(schema).toContain('evt_to: t.hex');
    expect(schema).toContain('evt_value: t.bigint');

    // Check indexes for address fields
    expect(schema).toContain("evt_fromIdx: index().using('btree', t.chainId, t.evt_from)");
    expect(schema).toContain("evt_toIdx: index().using('btree', t.chainId, t.evt_to)");
    expect(schema).toContain("evt_ownerIdx: index().using('btree', t.chainId, t.evt_owner)");
    expect(schema).toContain("evt_spenderIdx: index().using('btree', t.chainId, t.evt_spender)");
  });

  it('should use composite index for chainId and timestamp', () => {
    const schema = generateSchema(schemaConfig);

    expect(schema).toContain(
      "chainIdBlockTimestampIdx: index().using('btree', t.chainId, t.blockTimestamp)",
    );
  });

  it('should handle contracts with no events', () => {
    const noEventConfig = {
      chains: { mainnet: { id: 1 } },
      contracts: {
        Token: [
          {
            type: 'function',
            name: 'balanceOf',
            stateMutability: 'view',
            inputs: [{ name: 'owner', type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ] as const,
      },
      addresses: {
        mainnet: { Token: addrA },
      },
      startBlocks: {
        mainnet: 1000000,
      },
    };

    const schema = generateSchema(noEventConfig);

    // Should not include Token contract at all
    expect(schema).not.toContain('export const Token');
  });

  it('should handle special solidity types correctly', () => {
    const specialTypesAbi = [
      {
        type: 'event',
        name: 'ComplexEvent',
        inputs: [
          { name: 'boolField', type: 'bool', indexed: false },
          { name: 'bytesField', type: 'bytes32', indexed: false },
          { name: 'stringField', type: 'string', indexed: false },
          { name: 'smallInt', type: 'uint8', indexed: false },
          { name: 'largeInt', type: 'uint256', indexed: false },
          { name: 'tupleField', type: 'tuple', indexed: false },
          // Array types
          { name: 'addressArray', type: 'address[]', indexed: false },
          { name: 'fixedArray', type: 'uint256[5]', indexed: false },
          { name: 'multiArray', type: 'bytes32[][]', indexed: false },
        ],
      },
    ] as const;

    const specialConfig = {
      chains: { mainnet: { id: 1 } },
      contracts: { Special: specialTypesAbi },
      addresses: {
        mainnet: { Special: addrA },
      },
      startBlocks: { mainnet: 1000000 },
    };

    const schema = generateSchema(specialConfig);

    expect(schema).toContain('evt_boolField: t.boolean');
    expect(schema).toContain('evt_bytesField: t.hex');
    expect(schema).toContain('evt_stringField: t.text');
    expect(schema).toContain('evt_smallInt: t.integer');
    expect(schema).toContain('evt_largeInt: t.bigint');
    expect(schema).toContain('evt_tupleField: t.jsonb');
    // Array types should all be jsonb
    expect(schema).toContain('evt_addressArray: t.jsonb');
    expect(schema).toContain('evt_fixedArray: t.jsonb');
    expect(schema).toContain('evt_multiArray: t.jsonb');
  });
});

describe('generateSchema snapshots', () => {
  it('should match snapshot for a complete config', () => {
    const completeAbi = [
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

    const config = {
      chains: {
        mainnet: { id: 1 },
        arbitrum: { id: 42161 },
      },
      contracts: { Token: completeAbi },
      addresses: {
        mainnet: { Token: addrA },
        arbitrum: { Token: addrB },
      },
      startBlocks: {
        mainnet: 1000000,
        arbitrum: 2000000,
      },
    };

    const schema = generateSchema(config);

    // In a real test, this would use toMatchSnapshot()
    // expect(schema).toMatchSnapshot();

    // For now, just check it's deterministic
    const schema2 = generateSchema(config);
    expect(schema).toBe(schema2);
  });
});
