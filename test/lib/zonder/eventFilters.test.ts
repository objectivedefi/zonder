import { parseAbi } from 'viem';
import { describe, expect, it } from 'vitest';

import { excludeEvents, includeEvents } from '../../../src/lib/zonder/eventFilters';

describe('includeEvents', () => {
  const mockAbi = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
    'event Mint(address indexed to, uint256 value)',
    'event Burn(address indexed from, uint256 value)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 value) returns (bool)',
  ]);

  it('should include only specified events', () => {
    const filtered = includeEvents(mockAbi, ['Transfer', 'Approval']);

    // Should have 2 events + 2 functions = 4 items
    expect(filtered).toHaveLength(4);

    // Check events are included
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(true);

    // Check excluded events are not present
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Mint')).toBe(false);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Burn')).toBe(false);

    // Check functions are still present
    expect(filtered.some((item) => item.type === 'function' && item.name === 'balanceOf')).toBe(
      true,
    );
    expect(filtered.some((item) => item.type === 'function' && item.name === 'transfer')).toBe(
      true,
    );
  });

  it('should include single event', () => {
    const filtered = includeEvents(mockAbi, ['Transfer']);

    // Should have 1 event + 2 functions = 3 items
    expect(filtered).toHaveLength(3);

    expect(filtered.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(false);
  });

  it('should keep all non-event items', () => {
    const filtered = includeEvents(mockAbi, []);

    // Should have 0 events + 2 functions = 2 items
    expect(filtered).toHaveLength(2);

    // All events should be filtered out
    expect(filtered.some((item) => item.type === 'event')).toBe(false);

    // All functions should remain
    expect(filtered.filter((item) => item.type === 'function')).toHaveLength(2);
  });

  it('should handle empty ABI', () => {
    const emptyAbi = parseAbi([]);
    const filtered = includeEvents(emptyAbi, ['Transfer']);

    expect(filtered).toHaveLength(0);
  });

  it('should handle ABI with no events', () => {
    const noEventsAbi = parseAbi([
      'function balanceOf(address owner) view returns (uint256)',
      'function transfer(address to, uint256 value) returns (bool)',
    ]);

    const filtered = includeEvents(noEventsAbi, ['Transfer']);

    // Should keep all functions even though no matching events
    expect(filtered).toHaveLength(2);
    expect(filtered.every((item) => item.type === 'function')).toBe(true);
  });

  it('should include all specified events even if some dont exist', () => {
    const filtered = includeEvents(mockAbi, ['Transfer', 'NonExistentEvent', 'Approval']);

    // Should have 2 events (Transfer, Approval) + 2 functions = 4 items
    expect(filtered).toHaveLength(4);

    expect(filtered.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(true);
  });
});

describe('excludeEvents', () => {
  const mockAbi = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
    'event Mint(address indexed to, uint256 value)',
    'event Burn(address indexed from, uint256 value)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 value) returns (bool)',
  ]);

  it('should exclude specified events', () => {
    const filtered = excludeEvents(mockAbi, ['Mint', 'Burn']);

    // Should have 2 events (Transfer, Approval) + 2 functions = 4 items
    expect(filtered).toHaveLength(4);

    // Check included events are present
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(true);

    // Check excluded events are not present
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Mint')).toBe(false);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Burn')).toBe(false);

    // Check functions are still present
    expect(filtered.some((item) => item.type === 'function' && item.name === 'balanceOf')).toBe(
      true,
    );
    expect(filtered.some((item) => item.type === 'function' && item.name === 'transfer')).toBe(
      true,
    );
  });

  it('should exclude single event', () => {
    const filtered = excludeEvents(mockAbi, ['Transfer']);

    // Should have 3 events + 2 functions = 5 items
    expect(filtered).toHaveLength(5);

    expect(filtered.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(false);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Mint')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Burn')).toBe(true);
  });

  it('should keep all events when excluding empty array', () => {
    const filtered = excludeEvents(mockAbi, []);

    // Should have all 4 events + 2 functions = 6 items
    expect(filtered).toHaveLength(6);

    // All items should be present
    expect(filtered).toEqual(mockAbi);
  });

  it('should exclude all events when all are specified', () => {
    const filtered = excludeEvents(mockAbi, ['Transfer', 'Approval', 'Mint', 'Burn']);

    // Should have 0 events + 2 functions = 2 items
    expect(filtered).toHaveLength(2);

    // No events should remain
    expect(filtered.some((item) => item.type === 'event')).toBe(false);

    // All functions should remain
    expect(filtered.every((item) => item.type === 'function')).toBe(true);
  });

  it('should handle empty ABI', () => {
    const emptyAbi = parseAbi([]);
    const filtered = excludeEvents(emptyAbi, ['Transfer']);

    expect(filtered).toHaveLength(0);
  });

  it('should handle ABI with no events', () => {
    const noEventsAbi = parseAbi([
      'function balanceOf(address owner) view returns (uint256)',
      'function transfer(address to, uint256 value) returns (bool)',
    ]);

    const filtered = excludeEvents(noEventsAbi, ['Transfer']);

    // Should keep all functions (no events to exclude)
    expect(filtered).toHaveLength(2);
    expect(filtered.every((item) => item.type === 'function')).toBe(true);
  });

  it('should handle excluding non-existent events', () => {
    const filtered = excludeEvents(mockAbi, ['NonExistentEvent', 'AnotherFakeEvent']);

    // Should keep all original items
    expect(filtered).toHaveLength(6);
    expect(filtered).toEqual(mockAbi);
  });

  it('should handle mixed existing and non-existing events', () => {
    const filtered = excludeEvents(mockAbi, ['Transfer', 'NonExistentEvent', 'Mint']);

    // Should have 2 events (Approval, Burn) + 2 functions = 4 items
    expect(filtered).toHaveLength(4);

    expect(filtered.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(false);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Mint')).toBe(false);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(true);
    expect(filtered.some((item) => item.type === 'event' && item.name === 'Burn')).toBe(true);
  });
});

describe('includeEvents and excludeEvents composition', () => {
  const mockAbi = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
    'event Mint(address indexed to, uint256 value)',
    'event Burn(address indexed from, uint256 value)',
    'function balanceOf(address owner) view returns (uint256)',
  ]);

  it('should be able to chain include and exclude', () => {
    // First include Transfer, Approval, Mint (excludes Burn)
    const included = includeEvents(mockAbi, ['Transfer', 'Approval', 'Mint']);

    // Then exclude Mint from the result
    const final = excludeEvents(included, ['Mint']);

    // Should have Transfer, Approval events + function = 3 items
    expect(final).toHaveLength(3);
    expect(final.some((item) => item.type === 'event' && item.name === 'Transfer')).toBe(true);
    expect(final.some((item) => item.type === 'event' && item.name === 'Approval')).toBe(true);
    expect(final.some((item) => item.type === 'event' && item.name === 'Mint')).toBe(false);
    expect(final.some((item) => item.type === 'event' && item.name === 'Burn')).toBe(false);
  });

  it('should handle inverse operations', () => {
    // Include only Transfer
    const included = includeEvents(mockAbi, ['Transfer']);

    // Exclude Transfer should leave only functions
    const excluded = excludeEvents(included, ['Transfer']);

    // Should have 0 events + 1 function = 1 item
    expect(excluded).toHaveLength(1);
    expect(excluded.every((item) => item.type === 'function')).toBe(true);
  });
});
