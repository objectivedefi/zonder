export function solidityTypeToPgType(solidityType: string) {
  if (solidityType.includes('[') && solidityType.includes(']')) {
    return 'jsonb';
  }

  if (solidityType === 'address' || solidityType.startsWith('bytes')) {
    return 'hex';
  }
  if (solidityType === 'string') {
    return 'text';
  }
  if (solidityType === 'bool') {
    return 'boolean';
  }

  // Handle integer types with proper size parsing
  if (solidityType.startsWith('uint') || solidityType.startsWith('int')) {
    // Extract the size from uint8, uint256, int32, etc.
    const match = solidityType.match(/^u?int(\d+)?$/);
    if (!match) {
      return 'bigint'; // fallback for malformed types
    }

    const sizeStr = match[1];
    if (!sizeStr) {
      // Default uint or int (no size specified) is 256 bits
      return 'bigint';
    }

    const size = parseInt(sizeStr);
    if (size <= 32) {
      return 'integer';
    }
    return 'bigint';
  }

  // Handle struct/tuple types
  if (solidityType.startsWith('tuple')) {
    return 'jsonb';
  }

  throw new Error(`Unsupported type for solidity to pg conversion: ${solidityType}`);
}
