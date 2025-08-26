import { describe, expect, it } from 'vitest';

import { formatEventName } from '../../../src/lib/envio/formatEventName.js';

describe('formatEventName', () => {
  it('should convert camelCase to snake_case', () => {
    expect(formatEventName('tokenTransfer')).toBe('token_transfer');
    expect(formatEventName('userRegistered')).toBe('user_registered');
    expect(formatEventName('priceUpdated')).toBe('price_updated');
  });

  it('should convert PascalCase to snake_case', () => {
    expect(formatEventName('TokenTransfer')).toBe('token_transfer');
    expect(formatEventName('UserRegistered')).toBe('user_registered');
    expect(formatEventName('PriceUpdated')).toBe('price_updated');
  });

  it('should handle all caps', () => {
    expect(formatEventName('TRANSFER')).toBe('transfer');
    expect(formatEventName('TOKEN_TRANSFER')).toBe('token_transfer');
    expect(formatEventName('ERC20_TRANSFER')).toBe('erc20_transfer');
  });

  it('should handle mixed case patterns', () => {
    expect(formatEventName('ERC20Transfer')).toBe('erc20_transfer');
    expect(formatEventName('NFTMinted')).toBe('nft_minted');
    expect(formatEventName('DAOProposalCreated')).toBe('dao_proposal_created');
    expect(formatEventName('TVLUpdated')).toBe('tvl_updated');
  });

  it('should handle already snake_case strings', () => {
    expect(formatEventName('already_snake_case')).toBe('already_snake_case');
    expect(formatEventName('token_transfer')).toBe('token_transfer');
  });

  it('should handle single word strings', () => {
    expect(formatEventName('Transfer')).toBe('transfer');
    expect(formatEventName('transfer')).toBe('transfer');
    expect(formatEventName('TRANSFER')).toBe('transfer');
  });

  it('should handle strings with numbers', () => {
    expect(formatEventName('ERC20Transfer')).toBe('erc20_transfer');
    expect(formatEventName('ERC721Transfer')).toBe('erc721_transfer');
    expect(formatEventName('transfer2User')).toBe('transfer2_user');
    expect(formatEventName('v2Migration')).toBe('v2_migration');
  });

  it('should handle consecutive capitals', () => {
    expect(formatEventName('HTTPRequest')).toBe('http_request');
    expect(formatEventName('XMLParser')).toBe('xml_parser');
    expect(formatEventName('JSONData')).toBe('json_data');
    expect(formatEventName('APIResponse')).toBe('api_response');
  });

  it('should handle empty string', () => {
    expect(formatEventName('')).toBe('');
  });

  it('should throw error for non-string input', () => {
    expect(() => formatEventName(null as any)).toThrow('Event name must be a string');
    expect(() => formatEventName(undefined as any)).toThrow('Event name must be a string');
    expect(() => formatEventName(123 as any)).toThrow('Event name must be a string');
    expect(() => formatEventName({} as any)).toThrow('Event name must be a string');
  });

  it('should handle complex real-world event names', () => {
    expect(formatEventName('OwnershipTransferred')).toBe('ownership_transferred');
    expect(formatEventName('ApprovalForAll')).toBe('approval_for_all');
    expect(formatEventName('UniswapV2PairCreated')).toBe('uniswap_v2_pair_created');
    expect(formatEventName('LiquidityAddedToPool')).toBe('liquidity_added_to_pool');
  });

  it('should handle edge cases with underscores', () => {
    expect(formatEventName('_transfer')).toBe('_transfer');
    expect(formatEventName('transfer_')).toBe('transfer_');
    expect(formatEventName('_Transfer')).toBe('_transfer');
    expect(formatEventName('Transfer_')).toBe('transfer_');
  });
});
