import { parseAbi } from 'viem';
import { describe, expect, it } from 'vitest';

import { generateGraphQLSchema } from '../../../src/lib/envio/generateGraphQLSchema.js';
import type { ZonderConfig } from '../../../src/lib/zonder/types.js';

describe('generateGraphQLSchema', () => {
  it('should generate GraphQL schema for simple events', () => {
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

    const schema = generateGraphQLSchema(config);

    // Check EVault_Deposit type
    expect(schema).toContain('type EVault_Deposit');
    expect(schema).toContain('@index(fields: ["chainId", "timestamp"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_sender"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_owner"])');
    expect(schema).toContain('  id: ID!');
    expect(schema).toContain('  chainId: Int!');
    expect(schema).toContain('  blockNumber: BigInt!');
    expect(schema).toContain('  timestamp: BigInt!');
    expect(schema).toContain('  logIndex: Int!');
    expect(schema).toContain('  logAddress: String!');
    expect(schema).toContain('  evt_sender: String!');
    expect(schema).toContain('  evt_owner: String!');
    expect(schema).toContain('  evt_assets: BigInt!');
    expect(schema).toContain('  evt_shares: BigInt!');

    // Check EVault_Borrow type
    expect(schema).toContain('type EVault_Borrow');
    expect(schema).toContain('@index(fields: ["chainId", "evt_account"])');
    expect(schema).toContain('  evt_account: String!');
    expect(schema).toContain('  evt_assets: BigInt!');
  });

  it('should handle different Solidity types correctly', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TestContract: parseAbi([
          'event TestEvent(bool flag, uint8 smallNum, uint256 bigNum, int256 signedNum, bytes32 hash, string name, address[] users)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    expect(schema).toContain('type TestContract_TestEvent');
    expect(schema).toContain('  evt_flag: Boolean!');
    expect(schema).toContain('  evt_smallNum: BigInt!'); // All int/uint types now map to BigInt for Envio
    expect(schema).toContain('  evt_bigNum: BigInt!'); // uint256 needs BigInt
    expect(schema).toContain('  evt_signedNum: BigInt!'); // int256 needs BigInt
    expect(schema).toContain('  evt_hash: String!'); // bytes32 as String
    expect(schema).toContain('  evt_name: String!');
    expect(schema).toContain('  evt_users: [String!]!'); // address[] as [String!]
  });

  it('should handle events with no parameters', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        SimpleContract: parseAbi(['event EmptyEvent()']),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    expect(schema).toContain('type SimpleContract_EmptyEvent');
    // Should still have metadata fields
    expect(schema).toContain('  id: ID!');
    expect(schema).toContain('  chainId: Int!');
    // Should not have any evt_ fields
    expect(schema).not.toContain('evt_');
  });

  it('should handle multiple contracts with multiple events', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TokenA: parseAbi([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ]),
        TokenB: parseAbi([
          'event Approval(address indexed owner, address indexed spender, uint256 value)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    expect(schema).toContain('type TokenA_Transfer');
    expect(schema).toContain('  evt_from: String!');
    expect(schema).toContain('  evt_to: String!');
    expect(schema).toContain('  evt_value: BigInt!');

    expect(schema).toContain('type TokenB_Approval');
    expect(schema).toContain('  evt_owner: String!');
    expect(schema).toContain('  evt_spender: String!');
    expect(schema).toContain('  evt_value: BigInt!');
  });

  it('should handle tuple types', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        ComplexContract: parseAbi(['event ComplexEvent((address user, uint256 amount) data)']),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    expect(schema).toContain('type ComplexContract_ComplexEvent');
    // Tuples are serialized as String
    expect(schema).toContain('  evt_data: String!');
  });

  it('should generate indexes for address fields', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        GovernanceContract: parseAbi([
          'event ProposalCreated(uint256 proposalId, address indexed proposer, address[] targets, string description)',
          'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    // Check ProposalCreated indexes
    expect(schema).toContain('type GovernanceContract_ProposalCreated');
    expect(schema).toContain('@index(fields: ["chainId", "timestamp"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_proposer"])');
    // Arrays of addresses should also get indexed
    expect(schema).not.toContain('@index(fields: ["chainId", "evt_targets"])'); // Arrays don't get individual indexes

    // Check VoteCast indexes
    expect(schema).toContain('type GovernanceContract_VoteCast');
    expect(schema).toContain('@index(fields: ["chainId", "evt_voter"])');
  });

  it('should not generate indexes for non-address fields', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        DataContract: parseAbi([
          'event DataStored(uint256 indexed id, bytes32 hash, string metadata, bool active)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    // Should only have the default timestamp index
    expect(schema).toContain('@index(fields: ["chainId", "timestamp"])');
    // Should not have indexes for non-address fields
    expect(schema).not.toContain('@index(fields: ["chainId", "evt_id"])');
    expect(schema).not.toContain('@index(fields: ["chainId", "evt_hash"])');
    expect(schema).not.toContain('@index(fields: ["chainId", "evt_metadata"])');
    expect(schema).not.toContain('@index(fields: ["chainId", "evt_active"])');
  });

  it('should add header comment to generated schema', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        TestContract: parseAbi(['event TestEvent()']),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    expect(schema).toContain('# This file is auto-generated by zonder. Do not edit manually.');
  });

  it('should handle multiple address fields in single event', () => {
    const config: ZonderConfig<any, any> = {
      chains: {},
      contracts: {
        DEXContract: parseAbi([
          'event Swap(address indexed sender, address indexed recipient, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)',
        ]),
      },
      addresses: {},
      startBlocks: {},
    };

    const schema = generateGraphQLSchema(config);

    // Should have indexes for all address fields
    expect(schema).toContain('type DEXContract_Swap');
    expect(schema).toContain('@index(fields: ["chainId", "timestamp"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_sender"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_recipient"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_tokenIn"])');
    expect(schema).toContain('@index(fields: ["chainId", "evt_tokenOut"])');
  });
});
