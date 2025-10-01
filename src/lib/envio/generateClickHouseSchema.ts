import type { Abi, AbiEvent, AbiParameter } from 'viem';

import { safeWriteFileSync } from '../utils/safeWrite.js';
import type { ZonderConfig } from '../zonder/types.js';
import { formatToSnakeCase } from './formatToSnakeCase.js';

/**
 * Map Solidity type to ClickHouse type
 * Uses exact size matching for int/uint and FixedString for addresses/bytes
 */
function solidityTypeToClickHouseType(param: AbiParameter): string {
  const type = param.type;

  // Address - FixedString(42) for "0x" + 40 hex chars
  if (type === 'address') {
    return 'FixedString(42)';
  }

  // Fixed bytes (bytes1..bytes32)
  const bytesMatch = type.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const size = parseInt(bytesMatch[1], 10);
    // FixedString length = "0x" (2 chars) + (size * 2 hex chars)
    return `FixedString(${2 + size * 2})`;
  }

  // Dynamic bytes
  if (type === 'bytes') {
    return 'String';
  }

  // Boolean
  if (type === 'bool') {
    return 'Bool';
  }

  // String
  if (type === 'string') {
    return 'String';
  }

  // Unsigned integers (uint8..uint256)
  const uintMatch = type.match(/^uint(\d+)$/);
  if (uintMatch) {
    const bits = parseInt(uintMatch[1], 10);
    // Round up to nearest ClickHouse supported size: 8, 16, 32, 64, 128, 256
    const supportedSize = [8, 16, 32, 64, 128, 256].find((size) => size >= bits);
    if (supportedSize) {
      return `UInt${supportedSize}`;
    }
  }

  // Signed integers (int8..int256)
  const intMatch = type.match(/^int(\d+)$/);
  if (intMatch) {
    const bits = parseInt(intMatch[1], 10);
    // Round up to nearest ClickHouse supported size: 8, 16, 32, 64, 128, 256
    const supportedSize = [8, 16, 32, 64, 128, 256].find((size) => size >= bits);
    if (supportedSize) {
      return `Int${supportedSize}`;
    }
  }

  // Arrays - convert to Array(T)
  if (type.endsWith('[]')) {
    const baseType = type.slice(0, -2);
    const baseParam: AbiParameter = { ...param, type: baseType as any };
    const innerType = solidityTypeToClickHouseType(baseParam);
    return `Array(${innerType})`;
  }

  // Fixed-size arrays - convert to Array(T)
  const fixedArrayMatch = type.match(/^(.+)\[(\d+)\]$/);
  if (fixedArrayMatch) {
    const baseType = fixedArrayMatch[1];
    const baseParam: AbiParameter = { ...param, type: baseType as any };
    const innerType = solidityTypeToClickHouseType(baseParam);
    return `Array(${innerType})`; // ClickHouse doesn't enforce array size
  }

  // Tuples/structs - use JSON type
  if (type.startsWith('tuple')) {
    return 'JSON';
  }

  // Fallback to String for unknown types
  console.warn(`Unknown Solidity type: ${type}, defaulting to String`);
  return 'String';
}

/**
 * Generate table name from contract and event name
 */
function generateTableName(contractName: string, eventName: string): string {
  return `${formatToSnakeCase(contractName)}_${formatToSnakeCase(eventName)}`;
}

/**
 * Generate ClickHouse CREATE TABLE statement for an event
 */
function generateTableDDL(
  contractName: string,
  event: AbiEvent,
  databaseName: string = 'default',
): string {
  const tableName = generateTableName(contractName, event.name);
  const columns: string[] = [];

  // Common fields for all event tables
  columns.push('    id String');
  columns.push('    chain_id UInt32');
  columns.push('    tx_hash FixedString(66)');
  columns.push('    block_number UInt64');
  columns.push('    block_timestamp DateTime');
  columns.push('    log_index UInt32');
  columns.push('    log_address FixedString(42)');

  // Event-specific fields with evt_ prefix
  if (event.inputs && event.inputs.length > 0) {
    for (const input of event.inputs) {
      const fieldName = input.name || `param_${event.inputs.indexOf(input)}`;
      const clickHouseType = solidityTypeToClickHouseType(input);
      columns.push(`    evt_${fieldName} ${clickHouseType}`);
    }
  }

  // Metadata field
  columns.push('    _inserted_at DateTime DEFAULT now()');

  return `CREATE TABLE IF NOT EXISTS ${databaseName}.${tableName} (
${columns.join(',\n')}
)
ENGINE = ReplacingMergeTree(_inserted_at)
PARTITION BY toYYYYMM(block_timestamp)
ORDER BY (id);`;
}

/**
 * Generate complete ClickHouse schema SQL from ZonderConfig
 */
export function generateClickHouseSchema<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>, databaseName: string = 'default'): string {
  const statements: string[] = [];

  // Add header comment
  statements.push('-- ClickHouse Schema for Zonder-generated Indexer');
  statements.push('-- Auto-generated - DO NOT EDIT MANUALLY');
  statements.push('--');
  statements.push(`-- Database: ${databaseName}`);
  statements.push(`-- Generated: ${new Date().toISOString()}`);
  statements.push('--');
  statements.push('-- Tables use ReplacingMergeTree for automatic deduplication');
  statements.push('-- Monthly partitioning by block_timestamp for time-series queries');
  statements.push('');

  // Create database
  statements.push(`CREATE DATABASE IF NOT EXISTS ${databaseName};`);
  statements.push('');

  // Generate table for each event in each contract
  for (const [contractName, contractAbi] of Object.entries(config.contracts)) {
    const abi = contractAbi as Abi;
    const events = abi.filter((item) => item.type === 'event') as AbiEvent[];

    if (events.length === 0) {
      continue;
    }

    for (const event of events) {
      const ddl = generateTableDDL(contractName, event, databaseName);
      statements.push(ddl);
      statements.push('');
    }
  }

  return statements.join('\n');
}

/**
 * Generate and write ClickHouse schema to file
 */
export function generateAndWriteClickHouseSchema<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(
  config: ZonderConfig<TChains, TContracts>,
  outputPath: string = './clickhouse-schema.sql',
  databaseName: string = 'default',
  overwrite: boolean = false,
): void {
  const schema = generateClickHouseSchema(config, databaseName);
  safeWriteFileSync(outputPath, schema, { overwrite });
  console.log(`✅ Generated ClickHouse schema: ${outputPath}`);
}
