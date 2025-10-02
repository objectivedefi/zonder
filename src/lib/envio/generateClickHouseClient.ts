import { safeWriteFileSync } from '../utils/safeWrite.js';

/**
 * Generate ClickHouse client module with Effect API
 */
export function generateClickHouseClient(): string {
  return `import { createClient } from '@clickhouse/client';
import { S, experimental_createEffect } from 'envio';

// ClickHouse client configuration from environment
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
const CLICKHOUSE_USERNAME = process.env.CLICKHOUSE_USERNAME || 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD;
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'default';

// Periodic reconciliation configuration
const CLICKHOUSE_RECONCILIATION_ENABLED = process.env.CLICKHOUSE_RECONCILIATION_ENABLED !== 'false';
const CLICKHOUSE_RECONCILIATION_INTERVAL_MS = parseInt(
  process.env.CLICKHOUSE_RECONCILIATION_INTERVAL_MS || '60000',
  10
);

// Envio's default reorg safety threshold (https://docs.envio.dev/docs/HyperIndex/reorgs-support)
// Blocks within this distance from the chain head are considered "unconfirmed" and may be reorged
const CONFIRMED_BLOCK_THRESHOLD = parseInt(
  process.env.CLICKHOUSE_CONFIRMED_BLOCK_THRESHOLD || '200',
  10
);

const ENVIO_MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '5000', 10);

let clickHouseClient: ReturnType<typeof createClient> | null = null;

function getClickHouseClient() {
  if (!clickHouseClient) {
    if (!CLICKHOUSE_URL) {
      throw new Error(
        'CLICKHOUSE_URL is required. Set it in your .env file or environment variables.'
      );
    }

    try {
    clickHouseClient = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USERNAME,
      password: CLICKHOUSE_PASSWORD,
      database: CLICKHOUSE_DATABASE,
      request_timeout: 30000,
      max_open_connections: 10,
        compression: {
          request: true,
          response: true,
        },
      });

      console.log(\`[ClickHouse] Connected to database: \${CLICKHOUSE_DATABASE}\`);
    } catch (error) {
      console.error('[ClickHouse] Failed to initialize client:', error);
      throw error;
    }
  }

  return clickHouseClient;
}

interface BatchAccumulator {
  [tableName: string]: any[];
}

let currentBatch: BatchAccumulator = {};
let batchEventCount = 0;

export function serializeForClickHouse(data: any): string {
  const sanitized = sanitizeData(data);
  return JSON.stringify(sanitized);
}

function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') return data.toString();
  if (typeof data === 'boolean') return data ? 1 : 0;

  if (Array.isArray(data)) {
    const hasNamedProps = Object.keys(data).some((key) => isNaN(Number(key)) && key !== 'length');
    
    if (hasNamedProps) {
      const result: any = {};
      for (const key in data) {
        if (isNaN(Number(key)) && key !== 'length') {
          result[key] = sanitizeData(data[key]);
        }
      }
      return result;
    }

    return data.map((item) => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeData(value);
    }
    return result;
  }

  return data;
}

async function flushBatch(): Promise<void> {
  if (batchEventCount === 0) return;

  const client = getClickHouseClient();
  const tablesToWrite = Object.keys(currentBatch);
  const totalEvents = batchEventCount;

  const batchToWrite = currentBatch;
  currentBatch = {};
  batchEventCount = 0;

  try {
    await Promise.all(
      tablesToWrite.map(async (table) => {
        const events = batchToWrite[table];
        if (events.length === 0) return;

        await client.insert({
          table,
          values: events,
          format: 'JSONEachRow',
        });
      })
    );

    console.log(
      \`[ClickHouse] Flushed \${totalEvents} events to \${tablesToWrite.length} tables\`
    );
  } catch (error: any) {
    const failedTable = tablesToWrite.find((t) => batchToWrite[t].length > 0);
    console.error(\`[ClickHouse] Batch insert failed\`);
    if (failedTable) {
      console.error(\`  Table: \${failedTable}\`);
      console.error(\`  Events: \${batchToWrite[failedTable].length}\`);
      console.error(\`  Sample:\`, JSON.stringify(batchToWrite[failedTable][0], null, 2));
    }
    console.error(\`  Error:\`, error.message || error);
    throw error;
  }
}

export const writeToClickHouse = experimental_createEffect(
  {
    name: 'writeToClickHouse',
    input: { table: S.string, data: S.jsonString(S.string) },
    output: S.boolean,
  },
  async ({ input }) => {
    const parsed = typeof input.data === 'string' ? JSON.parse(input.data) : input.data;

    if (!currentBatch[input.table]) {
      currentBatch[input.table] = [];
    }
    currentBatch[input.table].push(parsed);
    batchEventCount++;

    if (batchEventCount >= ENVIO_MAX_BATCH_SIZE) {
      await flushBatch();
    }

    return true;
  },
);

export { flushBatch as flushClickHouseBatch };

/**
 * Query Envio's watermarks from PostgreSQL
 * These represent what Envio has fetched and attempted to process
 */
async function getPgWatermarks(): Promise<Record<number, number>> {
  const { default: postgres } = await import('postgres');
  const sql = postgres({
    host: process.env.ENVIO_PG_HOST || 'localhost',
    port: Number(process.env.ENVIO_PG_PORT) || 5432,
    database: process.env.ENVIO_PG_DATABASE || 'postgres',
    username: process.env.ENVIO_PG_USER || 'postgres',
    password: process.env.ENVIO_PG_PASSWORD,
    ssl: process.env.ENVIO_PG_SSL_MODE === 'require' ? 'require' : undefined,
  });

  try {
    const schema = process.env.ENVIO_PG_PUBLIC_SCHEMA || 'public';
    const rows = await sql\`
      SELECT chain_id, MAX(block_number) as max_block
      FROM \${sql(schema)}.end_of_block_range_scanned_data
      GROUP BY chain_id
    \`;

    const watermarks: Record<number, number> = {};
    for (const row of rows) {
      watermarks[row.chain_id] = Number(row.max_block);
    }

    return watermarks;
  } catch (error: any) {
    // First run: table doesn't exist yet, Envio will create it
    if (error?.code === '42P01') {
      console.log('[ClickHouse] First run - Envio tables not created yet');
      return {};
    }
    throw error;
  } finally {
    await sql.end();
  }
}

/**
 * Query PostgreSQL for chain processing status from Envio's internal metadata
 * Returns source_block (blockchain head) per chain
 */
async function getPgChainHeads(): Promise<Record<number, number>> {
  const { default: postgres } = await import('postgres');
  const sql = postgres({
    host: process.env.ENVIO_PG_HOST || 'localhost',
    port: Number(process.env.ENVIO_PG_PORT) || 5432,
    database: process.env.ENVIO_PG_DATABASE || 'postgres',
    username: process.env.ENVIO_PG_USER || 'postgres',
    password: process.env.ENVIO_PG_PASSWORD,
    ssl: process.env.ENVIO_PG_SSL_MODE === 'require' ? 'require' : undefined,
  });

  try {
    const schema = process.env.ENVIO_PG_PUBLIC_SCHEMA || 'public';
    const rows = await sql\`
      SELECT id as chain_id, source_block
      FROM \${sql(schema)}.envio_chains
      WHERE source_block IS NOT NULL
    \`;

    const heads: Record<number, number> = {};
    for (const row of rows) {
      heads[row.chain_id] = Number(row.source_block);
    }

    return heads;
  } catch (error: any) {
    if (error?.code === '42P01') {
      console.log('[ClickHouse] First run - envio_chains not created yet');
      return {};
    }
    throw error;
  } finally {
    await sql.end();
  }
}

/**
 * Get all event table names from ClickHouse
 */
async function getAllEventTables(): Promise<string[]> {
  const client = getClickHouseClient();
  const result = await client.query({
    query: \`
      SELECT name 
      FROM system.tables 
      WHERE database = '\${CLICKHOUSE_DATABASE}' 
        AND name NOT LIKE '.%'
        AND engine LIKE '%MergeTree%'
      ORDER BY name
    \`,
    format: 'JSONEachRow',
  });

  const rows = await result.json<{ name: string }>();
  return rows.map((r) => r.name);
}

/**
 * Query actual ClickHouse state - what's really been written
 * This is the source of truth for what data exists
 */
async function getClickHouseMaxBlocks(): Promise<Record<number, number>> {
  const client = getClickHouseClient();
  const tables = await getAllEventTables();

  if (tables.length === 0) {
    console.log('[ClickHouse] No event tables found - first run or empty database');
    return {};
  }

  // Query max block across all tables per chain
  const query = tables
    .map(
      (table) =>
        \`SELECT chain_id, MAX(block_number) as max_block FROM \${CLICKHOUSE_DATABASE}.\${table} GROUP BY chain_id\`
    )
    .join(' UNION ALL ');

  const result = await client.query({
    query: \`
      WITH all_maxes AS (\${query})
      SELECT chain_id, MAX(max_block) as max_block
      FROM all_maxes
      GROUP BY chain_id
    \`,
    format: 'JSONEachRow',
  });

  const rows = await result.json<{ chain_id: number; max_block: string }>();

  const maxBlocks: Record<number, number> = {};
  for (const row of rows) {
    maxBlocks[row.chain_id] = Number(row.max_block);
  }

  return maxBlocks;
}

/**
 * Delete orphaned blocks from ClickHouse
 * Called on startup when CH has blocks beyond PG watermark
 * Optimized: Only deletes from tables that actually have orphaned data
 */
async function deleteBlocksAfter(chainId: number, safeBlock: number): Promise<void> {
  const client = getClickHouseClient();
  const tables = await getAllEventTables();

  if (tables.length === 0) return;

  // Selective reconciliation: Query which tables have orphaned data
  const countQuery = tables
    .map(
      (table) =>
        \`SELECT '\${table}' as table_name, COUNT(*) as orphaned_count 
         FROM \${CLICKHOUSE_DATABASE}.\${table} 
         WHERE chain_id = {chain_id: UInt32} AND block_number > {safe_block: UInt64}\`
    )
    .join(' UNION ALL ');

  const countResult = await client.query({
    query: countQuery,
    query_params: {
      chain_id: chainId,
      safe_block: safeBlock,
    },
    format: 'JSONEachRow',
  });

  const counts = await countResult.json<{ table_name: string; orphaned_count: string }>();
  const tablesToClean = counts
    .filter((row) => Number(row.orphaned_count) > 0)
    .map((row) => row.table_name);

  if (tablesToClean.length === 0) {
    console.log(\`[ClickHouse Cleanup] Chain \${chainId}: No orphaned data found\`);
    return;
  }

  console.log(
    \`[ClickHouse Cleanup] Chain \${chainId}: Deleting blocks > \${safeBlock} from \${tablesToClean.length}/\${tables.length} tables\`
  );

  // Delete in parallel, only from tables with orphaned data
  await Promise.all(
    tablesToClean.map((table) =>
      client.command({
        query: \`
          DELETE FROM \${CLICKHOUSE_DATABASE}.\${table}
          WHERE chain_id = {chain_id: UInt32}
            AND block_number > {safe_block: UInt64}
        \`,
        query_params: {
          chain_id: chainId,
          safe_block: safeBlock,
        },
      })
    )
  );

  const totalOrphaned = counts.reduce((sum, row) => sum + Number(row.orphaned_count), 0);
  console.log(
    \`[ClickHouse] Chain \${chainId}: Deleted \${totalOrphaned} orphaned rows from \${tablesToClean.length} tables\`
  );
}

/**
 * Initialize ClickHouse and reconcile state with PostgreSQL
 * Detects and cleans up orphaned data from reorgs or crashes
 * Uses Envio's 200-block confirmation threshold to avoid deleting blocks in the reorg window
 */
export async function initializeClickHouse(): Promise<void> {
  console.log('[ClickHouse] Reconciliation - checking for orphaned data...');

  try {
    const pgWatermarks = await getPgWatermarks();
    const pgChainHeads = await getPgChainHeads();
    const chMaxBlocks = await getClickHouseMaxBlocks();

    for (const [chainId, pgWatermark] of Object.entries(pgWatermarks)) {
      const chMaxBlock = chMaxBlocks[Number(chainId)] || 0;
      const chainHead = pgChainHeads[Number(chainId)] || pgWatermark;

      // Calculate safety threshold: blocks older than this are considered "confirmed"
      // and safe to delete if orphaned (https://docs.envio.dev/docs/HyperIndex/reorgs-support)
      const safeThreshold = chainHead - CONFIRMED_BLOCK_THRESHOLD;

      if (chMaxBlock > pgWatermark) {
        // ClickHouse has orphaned data beyond what PG knows about
        
        if (chMaxBlock > chainHead) {
          // Orphaned blocks BEYOND blockchain head - corrupt/test data, delete immediately
          console.warn(
            \`[ClickHouse] Chain \${chainId}: Deleting orphaned blocks \${
              pgWatermark + 1
            } to \${chMaxBlock} (BEYOND chain head: \${chainHead})\`
          );
          await deleteBlocksAfter(Number(chainId), pgWatermark);
        } else if (chMaxBlock <= safeThreshold) {
          // Orphaned blocks below safety threshold - old and confirmed, safe to delete
          console.warn(
            \`[ClickHouse] Chain \${chainId}: Deleting confirmed orphaned blocks \${
              pgWatermark + 1
            } to \${chMaxBlock} (head: \${chainHead}, threshold: \${safeThreshold})\`
          );
          await deleteBlocksAfter(Number(chainId), pgWatermark);
        } else {
          // Orphaned blocks within reorg window (safeThreshold < block <= chainHead)
          // Might be racing with active writes - skip cleanup
          console.warn(
            \`[ClickHouse] Chain \${chainId}: Detected orphaned blocks \${
              pgWatermark + 1
            } to \${chMaxBlock} within reorg window (head: \${chainHead}, threshold: \${safeThreshold}) - skipping cleanup\`
          );
        }
      } else if (chMaxBlock < pgWatermark) {
        // ClickHouse is behind - effects failed or not yet run
        const gap = pgWatermark - chMaxBlock;
        console.info(
          \`[ClickHouse] Chain \${chainId}: CH at block \${chMaxBlock}, PG watermark at \${pgWatermark}. \` +
            \`Gap of \${gap} blocks will be re-processed.\`
        );
      } else {
        console.log(\`[ClickHouse] Chain \${chainId}: Synced at block \${pgWatermark}\`);
      }
    }

    console.log('[ClickHouse] Reconciliation complete');
  } catch (error) {
    console.error('[ClickHouse] Reconciliation failed:', error);
    throw error;
  }
}

let reconciliationInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic reconciliation to catch mid-run reorgs
 * Uses 200-block safety threshold to avoid race conditions with active writes
 */
export function startPeriodicReconciliation(intervalMs: number = 60000): void {
  if (reconciliationInterval) {
    console.warn('[ClickHouse] Periodic reconciliation already running');
    return;
  }

  console.log(
    \`[ClickHouse] Starting periodic reconciliation (every \${intervalMs}ms)\`
  );

  reconciliationInterval = setInterval(async () => {
    try {
      await initializeClickHouse();
    } catch (error) {
      console.error('[ClickHouse] Periodic reconciliation failed:', error);
      // Don't crash indexer on transient failures
    }
  }, intervalMs);
}

/**
 * Stop periodic reconciliation (for graceful shutdown)
 */
export function stopPeriodicReconciliation(): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
    console.log('[ClickHouse] Stopped periodic reconciliation');
  }
}

export async function shutdownClickHouse(): Promise<void> {
  stopPeriodicReconciliation();

  if (batchEventCount > 0) {
    console.log(\`[ClickHouse] Flushing \${batchEventCount} remaining events before shutdown\`);
    try {
      await flushBatch();
    } catch (error) {
      console.error('[ClickHouse] Failed to flush final batch:', error);
    }
  }

  if (clickHouseClient) {
    try {
    await clickHouseClient.close();
    clickHouseClient = null;
      console.log('[ClickHouse] Connection closed');
    } catch (error) {
      console.error('[ClickHouse] Error closing connection:', error);
    }
  }
}

// Auto-initialize on module load
(async () => {
  try {
    await initializeClickHouse();
    
    if (CLICKHOUSE_RECONCILIATION_ENABLED) {
      startPeriodicReconciliation(CLICKHOUSE_RECONCILIATION_INTERVAL_MS);
    } else {
      console.log('[ClickHouse] Periodic reconciliation disabled');
    }
  } catch (error: any) {
    console.error('[ClickHouse] Startup failed:', error.message || error);
    console.error('[ClickHouse] Verify configuration and run: pnpm zonder migrate');
    process.exit(1);
  }
})();

let isShuttingDown = false;

process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\\n[ClickHouse] Received SIGINT, shutting down gracefully...');
  await shutdownClickHouse();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\\n[ClickHouse] Received SIGTERM, shutting down gracefully...');
  await shutdownClickHouse();
  process.exit(0);
});
`;
}

/**
 * Generate and write ClickHouse client to file
 */
export function generateAndWriteClickHouseClient(
  outputPath: string = './src/clickhouse.ts',
  overwrite: boolean = false,
): void {
  const client = generateClickHouseClient();
  safeWriteFileSync(outputPath, client, { overwrite });
  console.log(`✅ Generated ClickHouse client: ${outputPath}`);
}
