import { describe, expect, it } from 'vitest';

import { formatToSnakeCase } from '../../../src/lib/envio/formatToSnakeCase.js';

describe('formatToSnakeCase', () => {
  it('should convert camelCase to snake_case', () => {
    expect(formatToSnakeCase('tokenTransfer')).toBe('token_transfer');
    expect(formatToSnakeCase('userRegistered')).toBe('user_registered');
    expect(formatToSnakeCase('priceUpdated')).toBe('price_updated');
  });

  it('should convert PascalCase to snake_case', () => {
    expect(formatToSnakeCase('TokenTransfer')).toBe('token_transfer');
    expect(formatToSnakeCase('UserRegistered')).toBe('user_registered');
    expect(formatToSnakeCase('PriceUpdated')).toBe('price_updated');
  });

  it('should handle all caps', () => {
    expect(formatToSnakeCase('TRANSFER')).toBe('transfer');
    expect(formatToSnakeCase('TOKEN_TRANSFER')).toBe('token_transfer');
    expect(formatToSnakeCase('ERC20_TRANSFER')).toBe('erc20_transfer');
  });

  it('should handle mixed case patterns', () => {
    expect(formatToSnakeCase('ERC20Transfer')).toBe('erc20_transfer');
    expect(formatToSnakeCase('NFTMinted')).toBe('nft_minted');
    expect(formatToSnakeCase('DAOProposalCreated')).toBe('dao_proposal_created');
    expect(formatToSnakeCase('TVLUpdated')).toBe('tvl_updated');
  });

  it('should handle already snake_case strings', () => {
    expect(formatToSnakeCase('already_snake_case')).toBe('already_snake_case');
    expect(formatToSnakeCase('token_transfer')).toBe('token_transfer');
  });

  it('should handle single word strings', () => {
    expect(formatToSnakeCase('Transfer')).toBe('transfer');
    expect(formatToSnakeCase('transfer')).toBe('transfer');
    expect(formatToSnakeCase('TRANSFER')).toBe('transfer');
  });

  it('should handle strings with numbers', () => {
    expect(formatToSnakeCase('ERC20Transfer')).toBe('erc20_transfer');
    expect(formatToSnakeCase('ERC721Transfer')).toBe('erc721_transfer');
    expect(formatToSnakeCase('transfer2User')).toBe('transfer2_user');
    expect(formatToSnakeCase('v2Migration')).toBe('v2_migration');
  });

  it('should handle consecutive capitals', () => {
    expect(formatToSnakeCase('HTTPRequest')).toBe('http_request');
    expect(formatToSnakeCase('XMLParser')).toBe('xml_parser');
    expect(formatToSnakeCase('JSONData')).toBe('json_data');
    expect(formatToSnakeCase('APIResponse')).toBe('api_response');
  });

  it('should handle empty string', () => {
    expect(formatToSnakeCase('')).toBe('');
  });

  it('should throw error for non-string input', () => {
    expect(() => formatToSnakeCase(null as any)).toThrow('Event name must be a string');
    expect(() => formatToSnakeCase(undefined as any)).toThrow('Event name must be a string');
    expect(() => formatToSnakeCase(123 as any)).toThrow('Event name must be a string');
    expect(() => formatToSnakeCase({} as any)).toThrow('Event name must be a string');
  });

  it('should handle complex real-world event names', () => {
    expect(formatToSnakeCase('OwnershipTransferred')).toBe('ownership_transferred');
    expect(formatToSnakeCase('ApprovalForAll')).toBe('approval_for_all');
    expect(formatToSnakeCase('UniswapV2PairCreated')).toBe('uniswap_v2_pair_created');
    expect(formatToSnakeCase('LiquidityAddedToPool')).toBe('liquidity_added_to_pool');
  });

  it('should handle edge cases with underscores', () => {
    expect(formatToSnakeCase('_transfer')).toBe('_transfer');
    expect(formatToSnakeCase('transfer_')).toBe('transfer_');
    expect(formatToSnakeCase('_Transfer')).toBe('_transfer');
    expect(formatToSnakeCase('Transfer_')).toBe('transfer_');
  });
});
