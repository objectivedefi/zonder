import { describe, expect, it } from 'vitest';

import { formatToSnakeCase } from '../../../src/lib/envio/formatToSnakeCase';

describe('formatToSnakeCase', () => {
  it('converts camelCase to snake_case', () => {
    expect(formatToSnakeCase('camelCase')).toBe('camel_case');
    expect(formatToSnakeCase('myVariableName')).toBe('my_variable_name');
  });

  it('converts PascalCase to snake_case', () => {
    expect(formatToSnakeCase('PascalCase')).toBe('pascal_case');
    expect(formatToSnakeCase('EVault')).toBe('e_vault');
    expect(formatToSnakeCase('ERC20Token')).toBe('erc20_token');
  });

  it('handles consecutive capitals', () => {
    expect(formatToSnakeCase('HTTPSConnection')).toBe('https_connection');
    expect(formatToSnakeCase('XMLParser')).toBe('xml_parser');
  });

  it('handles already snake_case strings', () => {
    expect(formatToSnakeCase('already_snake_case')).toBe('already_snake_case');
    expect(formatToSnakeCase('my_var')).toBe('my_var');
  });

  it('handles single words', () => {
    expect(formatToSnakeCase('word')).toBe('word');
    expect(formatToSnakeCase('Word')).toBe('word');
  });

  it('handles numbers', () => {
    expect(formatToSnakeCase('erc20Token')).toBe('erc20_token');
    expect(formatToSnakeCase('token2')).toBe('token2');
    expect(formatToSnakeCase('token2Factory')).toBe('token2_factory');
  });

  it('handles mixed cases', () => {
    expect(formatToSnakeCase('GovSetMaxLiquidationDiscount')).toBe(
      'gov_set_max_liquidation_discount',
    );
    expect(formatToSnakeCase('balanceTrackerStatus')).toBe('balance_tracker_status');
  });

  it('throws error for non-string input', () => {
    expect(() => formatToSnakeCase(123 as any)).toThrow('Event name must be a string');
    expect(() => formatToSnakeCase(null as any)).toThrow('Event name must be a string');
    expect(() => formatToSnakeCase(undefined as any)).toThrow('Event name must be a string');
  });
});
