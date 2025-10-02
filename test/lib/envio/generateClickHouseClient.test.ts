import { describe, expect, it } from 'vitest';

import { generateClickHouseClient } from '../../../src/lib/envio/generateClickHouseClient';

describe('generateClickHouseClient', () => {
  it('generates valid TypeScript code', () => {
    const client = generateClickHouseClient();

    expect(client).toContain("import { createClient } from '@clickhouse/client'");
    expect(client).toContain("import { S, experimental_createEffect } from 'envio'");
  });

  it('includes environment variable configuration', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('const CLICKHOUSE_URL');
    expect(client).toContain('const CLICKHOUSE_USERNAME');
    expect(client).toContain('const CLICKHOUSE_PASSWORD');
    expect(client).toContain('const CLICKHOUSE_DATABASE');
  });

  it('includes batch size configuration', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('const ENVIO_MAX_BATCH_SIZE');
  });

  it('includes singleton client pattern', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('let clickHouseClient');
    expect(client).toContain('function getClickHouseClient()');
    expect(client).toContain('if (!clickHouseClient)');
  });

  it('includes client configuration options', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('request_timeout: 30000');
    expect(client).toContain('max_open_connections: 10');
  });

  it('includes serializeForClickHouse function', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('export function serializeForClickHouse');
    expect(client).toContain('JSON.stringify');
  });

  it('includes sanitizeData function', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('function sanitizeData(data: any)');
    expect(client).toContain("typeof data === 'bigint'");
    expect(client).toContain("typeof data === 'boolean'");
  });

  it('handles BigInt conversion in sanitizeData', () => {
    const client = generateClickHouseClient();

    expect(client).toContain("if (typeof data === 'bigint') return data.toString()");
  });

  it('handles Boolean conversion to 0/1 in sanitizeData', () => {
    const client = generateClickHouseClient();

    expect(client).toContain("if (typeof data === 'boolean') return data ? 1 : 0");
  });

  it('handles array sanitization with named properties', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('if (Array.isArray(data))');
    expect(client).toContain('const hasNamedProps');
    expect(client).toContain("isNaN(Number(key)) && key !== 'length'");
  });

  it('includes batch accumulator interface', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('interface BatchAccumulator');
    expect(client).toContain('[tableName: string]: any[]');
  });

  it('includes batch state variables', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('let currentBatch: BatchAccumulator');
    expect(client).toContain('let batchEventCount');
  });

  it('includes flushBatch function', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('async function flushBatch()');
    expect(client).toContain('if (batchEventCount === 0) return');
    expect(client).toContain('await client.insert');
  });

  it('includes batch flush with parallel writes', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('await Promise.all(');
    expect(client).toContain('tablesToWrite.map(async (table)');
  });

  it('includes error handling in flushBatch', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('try {');
    expect(client).toContain('} catch (error)');
    expect(client).toContain('console.error');
    expect(client).toContain('throw error');
  });

  it('includes writeToClickHouse Effect', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('export const writeToClickHouse = experimental_createEffect');
    expect(client).toContain("name: 'writeToClickHouse'");
    expect(client).toContain('input: { table: S.string, data: S.jsonString(S.string) }');
    expect(client).toContain('output: S.boolean');
  });

  it('includes batching logic in writeToClickHouse', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('if (!currentBatch[input.table])');
    expect(client).toContain('currentBatch[input.table].push(parsed)');
    expect(client).toContain('batchEventCount++');
  });

  it('includes auto-flush when batch size reached', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('if (batchEventCount >= ENVIO_MAX_BATCH_SIZE)');
    expect(client).toContain('await flushBatch()');
  });

  it('exports flushBatch as flushClickHouseBatch', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('export { flushBatch as flushClickHouseBatch }');
  });

  it('includes shutdownClickHouse function', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('export async function shutdownClickHouse()');
    expect(client).toContain('if (batchEventCount > 0)');
    expect(client).toContain('await flushBatch()');
  });

  it('includes shutdown logging', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('Flushing');
    expect(client).toContain('remaining events');
    expect(client).toContain('Connection closed');
  });

  it('includes error handling in shutdown', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('try {');
    expect(client).toContain('await flushBatch()');
    expect(client).toContain('} catch (error)');
    expect(client).toContain('Failed to flush final batch');
  });

  it('includes SIGINT handler', () => {
    const client = generateClickHouseClient();

    expect(client).toContain("process.on('SIGINT'");
    expect(client).toContain('await shutdownClickHouse()');
    expect(client).toContain('process.exit(0)');
  });

  it('includes SIGTERM handler', () => {
    const client = generateClickHouseClient();

    expect(client).toContain("process.on('SIGTERM'");
    expect(client).toContain('await shutdownClickHouse()');
    expect(client).toContain('process.exit(0)');
  });

  it('includes client initialization logging', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('console.log');
    expect(client).toContain('Connected to database');
  });

  it('includes batch flush logging', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('Flushed');
    expect(client).toContain('events to');
    expect(client).toContain('tables');
  });

  it('includes detailed error logging with event samples', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('Batch insert failed');
    expect(client).toContain('Table:');
    expect(client).toContain('Events:');
    expect(client).toContain('Sample:');
    expect(client).toContain('JSON.stringify');
  });

  it('parses JSON string data', () => {
    const client = generateClickHouseClient();

    expect(client).toContain("typeof input.data === 'string' ? JSON.parse(input.data)");
  });

  it('resets batch state after flush', () => {
    const client = generateClickHouseClient();

    expect(client).toContain('currentBatch = {}');
    expect(client).toContain('batchEventCount = 0');
  });
});
