import { describe, expect, it } from 'vitest';

import { generateEnvExample } from '../../../src/lib/envio/generateEnvExample.js';

describe('generateEnvExample', () => {
  it('should generate basic env example with DB and performance settings', () => {
    const envContent = generateEnvExample();

    // Check DB connection variables
    expect(envContent).toContain('# DB Connection');
    expect(envContent).toContain('ENVIO_PG_HOST=');
    expect(envContent).toContain('ENVIO_PG_PORT=');
    expect(envContent).toContain('ENVIO_PG_USER=');
    expect(envContent).toContain('ENVIO_PG_PASSWORD=');
    expect(envContent).toContain('ENVIO_PG_DATABASE=');
    expect(envContent).toContain('ENVIO_PG_PUBLIC_SCHEMA=');
    expect(envContent).toContain('ENVIO_PG_SSL_MODE= # Use "require" for production');

    // Check performance optimization settings
    expect(envContent).toContain('# Performance Optimizations');
    expect(envContent).toContain('MAX_BATCH_SIZE=30000');
    expect(envContent).toContain('MAX_PARTITION_SIZE=50000');
    expect(envContent).toContain('ENVIO_MAX_PARTITION_CONCURRENCY=2');
    expect(envContent).toContain('ENVIO_THROTTLE_CHAIN_METADATA_INTERVAL_MILLIS=30000');
    expect(envContent).toContain('ENVIO_THROTTLE_PRUNE_STALE_DATA_INTERVAL_MILLIS=300000');
  });

  it('should include proper formatting and comments', () => {
    const envContent = generateEnvExample();

    // Should have proper section separation
    const lines = envContent.split('\n');
    expect(lines).toContain('# DB Connection');
    expect(lines).toContain('');
    expect(lines).toContain('# Performance Optimizations');

    // Should have comment for SSL mode
    expect(envContent).toContain('# Use "require" for production');
  });

  it('should be deterministic', () => {
    const content1 = generateEnvExample();
    const content2 = generateEnvExample();

    expect(content1).toBe(content2);
  });
});
