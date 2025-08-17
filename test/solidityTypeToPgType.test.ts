import { describe, expect, it } from 'vitest';

import { solidityTypeToPgType } from '../src/lib/solidityTypeToPgType';

describe('solidityTypeToPgType', () => {
  describe('basic types', () => {
    it('should handle address', () => {
      expect(solidityTypeToPgType('address')).toBe('hex');
    });

    it('should handle string', () => {
      expect(solidityTypeToPgType('string')).toBe('text');
    });

    it('should handle bool', () => {
      expect(solidityTypeToPgType('bool')).toBe('boolean');
    });

    it('should handle tuple', () => {
      expect(solidityTypeToPgType('tuple')).toBe('jsonb');
    });
  });

  describe('bytes types', () => {
    it('should handle fixed bytes', () => {
      expect(solidityTypeToPgType('bytes32')).toBe('hex');
      expect(solidityTypeToPgType('bytes4')).toBe('hex');
      expect(solidityTypeToPgType('bytes1')).toBe('hex');
    });

    it('should handle dynamic bytes', () => {
      expect(solidityTypeToPgType('bytes')).toBe('hex');
    });
  });

  describe('integer types', () => {
    it('should handle small uints as integer', () => {
      expect(solidityTypeToPgType('uint8')).toBe('integer');
      expect(solidityTypeToPgType('uint16')).toBe('integer');
      expect(solidityTypeToPgType('uint32')).toBe('integer'); // 32 bit should still be integer
    });

    it('should handle large uints as bigint', () => {
      expect(solidityTypeToPgType('uint64')).toBe('bigint');
      expect(solidityTypeToPgType('uint128')).toBe('bigint');
      expect(solidityTypeToPgType('uint256')).toBe('bigint');
    });

    it('should handle small ints as integer', () => {
      expect(solidityTypeToPgType('int8')).toBe('integer');
      expect(solidityTypeToPgType('int16')).toBe('integer');
      expect(solidityTypeToPgType('int32')).toBe('integer');
    });

    it('should handle large ints as bigint', () => {
      expect(solidityTypeToPgType('int64')).toBe('bigint');
      expect(solidityTypeToPgType('int128')).toBe('bigint');
      expect(solidityTypeToPgType('int256')).toBe('bigint');
    });

    it('should handle default uint/int as bigint', () => {
      expect(solidityTypeToPgType('uint')).toBe('bigint');
      expect(solidityTypeToPgType('int')).toBe('bigint');
    });
  });

  describe('array types', () => {
    it('should handle fixed size arrays', () => {
      expect(solidityTypeToPgType('uint256[5]')).toBe('jsonb');
      expect(solidityTypeToPgType('address[10]')).toBe('jsonb');
      expect(solidityTypeToPgType('bytes32[3]')).toBe('jsonb');
    });

    it('should handle dynamic arrays', () => {
      expect(solidityTypeToPgType('uint256[]')).toBe('jsonb');
      expect(solidityTypeToPgType('address[]')).toBe('jsonb');
      expect(solidityTypeToPgType('string[]')).toBe('jsonb');
      expect(solidityTypeToPgType('bytes[]')).toBe('jsonb');
      expect(solidityTypeToPgType('bool[]')).toBe('jsonb');
    });

    it('should handle multidimensional arrays', () => {
      expect(solidityTypeToPgType('uint256[][]')).toBe('jsonb');
      expect(solidityTypeToPgType('address[3][]')).toBe('jsonb');
      expect(solidityTypeToPgType('uint256[5][10]')).toBe('jsonb');
    });

    it('should handle nested complex arrays', () => {
      expect(solidityTypeToPgType('tuple[]')).toBe('jsonb');
      expect(solidityTypeToPgType('tuple[5]')).toBe('jsonb');
    });
  });

  describe('edge cases', () => {
    it('should handle unusual but valid types', () => {
      expect(solidityTypeToPgType('bytes19')).toBe('hex');
      expect(solidityTypeToPgType('uint24')).toBe('integer');
      expect(solidityTypeToPgType('int40')).toBe('bigint');
    });

    it('should throw for unsupported types', () => {
      expect(() => solidityTypeToPgType('mapping')).toThrow(
        'Unsupported type for solidity to pg conversion: mapping',
      );
      expect(() => solidityTypeToPgType('function')).toThrow(
        'Unsupported type for solidity to pg conversion: function',
      );
      expect(() => solidityTypeToPgType('contract')).toThrow(
        'Unsupported type for solidity to pg conversion: contract',
      );
      expect(() => solidityTypeToPgType('')).toThrow(
        'Unsupported type for solidity to pg conversion: ',
      );
    });
  });

  describe('real-world examples', () => {
    it('should handle complex event signatures', () => {
      // From ERC20 Transfer event
      expect(solidityTypeToPgType('address')).toBe('hex');
      expect(solidityTypeToPgType('uint256')).toBe('bigint');

      // From complex DeFi events
      expect(solidityTypeToPgType('uint256[]')).toBe('jsonb');
      expect(solidityTypeToPgType('address[]')).toBe('jsonb');
      expect(solidityTypeToPgType('bytes32[]')).toBe('jsonb');

      // From governance events
      expect(solidityTypeToPgType('string')).toBe('text');
      expect(solidityTypeToPgType('bool')).toBe('boolean');
      expect(solidityTypeToPgType('bytes')).toBe('hex');
    });
  });
});
