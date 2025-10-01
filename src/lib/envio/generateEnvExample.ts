import { safeWriteFileSync } from '../utils/safeWrite.js';

export function generateEnvExample(): string {
  return `# API Key
ENVIO_API_TOKEN=

# PostgreSQL Connection (Envio State)
ENVIO_PG_HOST=
ENVIO_PG_PORT=
ENVIO_PG_USER=
ENVIO_PG_PASSWORD=
ENVIO_PG_DATABASE=
ENVIO_PG_PUBLIC_SCHEMA=
ENVIO_PG_SSL_MODE= # Use "require" for production

# ClickHouse Connection (Event Analytics)
# See CLICKHOUSE.md for setup instructions
CLICKHOUSE_URL=https://your-instance.clickhouse.cloud:8443
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=your_password
CLICKHOUSE_DATABASE=your_database

# ClickHouse Batching (Optional - defaults shown)
MAX_BATCH_SIZE=5000                      # Events per batch before flush
CLICKHOUSE_FLUSH_INTERVAL_MS=5000        # Flush interval in milliseconds
CLICKHOUSE_BATCH_ENABLED=true            # Enable/disable batching

# Envio Performance Optimizations
ENVIO_HASURA=false
MAX_PARTITION_SIZE=50000
ENVIO_MAX_PARTITION_CONCURRENCY=2
ENVIO_THROTTLE_CHAIN_METADATA_INTERVAL_MILLIS=30000
ENVIO_THROTTLE_PRUNE_STALE_DATA_INTERVAL_MILLIS=300000
`;
}

export function generateAndWriteEnvExample(outputPath = '.env.example', overwrite = false): void {
  const content = generateEnvExample();
  safeWriteFileSync(outputPath, content, { overwrite });
}
