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

const ENVIO_MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '5000', 10);
const CLICKHOUSE_BATCH_SIZE = Math.floor(ENVIO_MAX_BATCH_SIZE / 5);

let clickHouseClient: ReturnType<typeof createClient> | null = null;

function getClickHouseClient() {
  if (!clickHouseClient) {
    if (!CLICKHOUSE_URL) {
      throw new Error('CLICKHOUSE_URL environment variable is required');
    }

    clickHouseClient = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USERNAME,
      password: CLICKHOUSE_PASSWORD,
      database: CLICKHOUSE_DATABASE,
      request_timeout: 30000,
      max_open_connections: 10,
    });

    console.log(\`✅ ClickHouse client initialized for database: \${CLICKHOUSE_DATABASE}\`);
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

  const writePromises = tablesToWrite.map(async (table) => {
    const events = batchToWrite[table];
    if (events.length === 0) return;

    try {
      await client.insert({ table, values: events, format: 'JSONEachRow' });
    } catch (error) {
      console.error(\`❌ ClickHouse insert failed for table: \${table}\`);
      console.error(\`   Events count: \${events.length}\`);
      console.error(\`   First event sample:\`, JSON.stringify(events[0], null, 2));
      console.error(\`   Error:\`, error);
      throw error;
    }
  });

  await Promise.all(writePromises);
  console.log(\`✅ ClickHouse batch flushed: \${totalEvents} events across \${tablesToWrite.length} tables\`);
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

    if (batchEventCount >= CLICKHOUSE_BATCH_SIZE) {
      await flushBatch();
    }

    return true;
  },
);

export { flushBatch as flushClickHouseBatch };

export async function shutdownClickHouse(): Promise<void> {
  if (batchEventCount > 0) {
    console.log(\`🔄 Flushing remaining \${batchEventCount} events before shutdown...\`);
    try {
      await flushBatch();
    } catch (error) {
      console.error('❌ Failed to flush remaining batch on shutdown:', error);
    }
  }

  if (clickHouseClient) {
    await clickHouseClient.close();
    clickHouseClient = null;
    console.log('✅ ClickHouse client closed');
  }
}

process.on('SIGINT', async () => {
  await shutdownClickHouse();
  process.exit(0);
});

process.on('SIGTERM', async () => {
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
