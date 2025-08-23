import fs from 'fs';

export function generateEnvExample(): string {
  return `# DB Connection
ENVIO_PG_HOST=
ENVIO_PG_PORT=
ENVIO_PG_USER=
ENVIO_PG_PASSWORD=
ENVIO_PG_DATABASE=
ENVIO_PG_PUBLIC_SCHEMA=
ENVIO_PG_SSL_MODE= # Use "require" for production

# Performance Optimizations
MAX_BATCH_SIZE=30000
MAX_PARTITION_SIZE=50000
ENVIO_MAX_PARTITION_CONCURRENCY=2
ENVIO_THROTTLE_CHAIN_METADATA_INTERVAL_MILLIS=30000
ENVIO_THROTTLE_PRUNE_STALE_DATA_INTERVAL_MILLIS=300000
`;
}

export function generateAndWriteEnvExample(outputPath = '.env.example'): void {
  const content = generateEnvExample();
  fs.writeFileSync(outputPath, content);
}
