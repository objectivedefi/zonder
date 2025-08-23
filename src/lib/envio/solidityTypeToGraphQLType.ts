/**
 * Maps Solidity types to GraphQL types
 */
export function solidityTypeToGraphQLType(solidityType: string): string {
  // Remove array notation for base type detection
  const baseType = solidityType.replace(/\[.*\]$/, '');
  const isArray = solidityType.includes('[');

  let graphqlType: string;

  if (baseType === 'address') {
    graphqlType = 'String';
  } else if (baseType === 'bool') {
    graphqlType = 'Boolean';
  } else if (baseType === 'string') {
    graphqlType = 'String';
  } else if (baseType.startsWith('bytes')) {
    graphqlType = 'String';
  } else if (baseType.startsWith('uint') || baseType.startsWith('int')) {
    // // Determine if it fits in Int or needs BigInt
    // const bits = baseType.match(/\d+/)?.[0];
    // if (!bits || parseInt(bits) > 32) {
    //   graphqlType = 'BigInt';
    // } else {
    //   // For smaller integers (uint8, uint16, uint32, int8, int16, int32), use Int
    //   graphqlType = 'Int';
    // }
    graphqlType = 'BigInt';
  } else if (baseType.startsWith('tuple')) {
    // For tuples, we'll use String (serialized JSON)
    graphqlType = 'String';
  } else {
    // Default fallback
    graphqlType = 'String';
  }

  // Add array notation if needed
  return isArray ? `[${graphqlType}!]` : graphqlType;
}
