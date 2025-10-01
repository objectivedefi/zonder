# Zonder

Multi-chain indexing config generator for Envio.

> [!WARNING]
> Pre-production API: expect breaking changes

## Quick Start

### Zonder + Envio

```bash
# 1. Initialize Envio (choose Greeter Template)
pnpx envio init

# 2. Install Zonder
pnpm add zonder
```

```typescript
// 3. Add your ABIs in abis/[ContractName].ts
// Tip: `pnpm zonder take-abi` extracts abi from local Foundry compilation artifacts
// File: abis/EVault.ts
export default [...] as const;

// 4. Create your zonder.config.ts
import { mainnet } from 'viem/chains';
import { ZonderConfig } from 'zonder';

import EVault from './abis/EVault';

export const zonderConfig = {
  chains: { mainnet },
  contracts: { EVault },
  addresses: { mainnet: { EVault: '0x...' } },
};
```

```bash
# 5. Configure environment
cp .env.example .env
# Set CLICKHOUSE_URL, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE

# 6. Generate files
pnpm zonder generate

# 7. Create ClickHouse tables
pnpm zonder migrate

# 8. Generate envio internals
pnpm envio codegen

# 9. Run
pnpm envio start
```

## CLI Commands

### `generate`

Generate Envio indexer files with ClickHouse support:

```bash
pnpm zonder generate
# Generates:
#   config.yaml           - Network and contract config
#   schema.graphql        - GraphQL entity definitions
#   src/EventHandlers.ts  - Event processors (write to ClickHouse)
#   clickhouse-schema.sql - ClickHouse table DDL
#   src/clickhouse.ts     - Batched ClickHouse client
#   .env.example          - Environment template
```

**ClickHouse Integration:**

- Enabled by default (disable with `clickhouse: { enabled: false }` in config)
- Events written directly to ClickHouse (bypasses PostgreSQL CDC)
- JSON string serialization for proper BigInt/Boolean handling
- Batching enabled (configurable via environment variables)
- Snake_case table names (e.g., `e_vault_deposit`)

### `migrate`

Create ClickHouse database and tables:

```bash
pnpm zonder migrate
# Creates database + tables from clickhouse-schema.sql

# Force migration (drops outdated tables, keeps matching ones)
pnpm zonder migrate --force
```

**How it works:**

1. Reads `CLICKHOUSE_DATABASE` from `.env`
2. Creates database if it doesn't exist
3. Creates all tables in parallel
4. With `--force`: drops tables not in schema, keeps existing ones

### `take-abi`

Extract ABIs from Foundry build artifacts:

```bash
pnpm zonder take-abi path/to/foundry/out ContractA ContractB
# Generates: abis/ContractA.ts, abis/ContractB.ts
```

### `find-start-blocks`

Auto-discover deployment blocks for all contracts:

```bash
pnpm zonder find-start-blocks
# Outputs: startBlocks config to copy-paste
# Generates: start-blocks.json
```

Features:

- **Smart skipping**: Only searches for contracts not already configured
- **Incremental discovery**: Preserves existing blocks, adds only new ones
- **Binary search**: Fast deployment block discovery using efficient algorithm
- **Multi-chain support**: Works across all configured chains

> **Performance tip**: Granular start blocks speed up historical backfill indexing by skipping blocks before contract deployment.

## Features

- **ClickHouse Direct Write**: Events written to ClickHouse for analytics (enabled by default)
  - 70% cost reduction vs PostgreSQL for high-volume events
  - No CDC pipeline complexity
  - Batched writes with JSON string serialization
  - Automatic snake_case table names
- **Type-safe Config**: Define contracts and chains in TypeScript
- **Multi-chain Support**: Index events across multiple networks
- **Factory Patterns**: Automatic discovery and indexing of factory-deployed contracts
- **Smart CLI**: Auto-generate configs, discover deployment blocks, extract ABIs

## Advanced Configuration

```typescript
// Factory-deployed contracts
factoryDeployed: {
  MyToken: {
    event: parseAbiItem('event TokenCreated(address indexed token)'),
    parameter: 'token',
    deployedBy: 'MyFactory',
  },
}

// Granular start blocks for performance
startBlocks: {
  mainnet: {
    EVault: 18500000,      // Specific start block for EVault
    Factory: 18000000,     // Specific start block for Factory
    default: 17000000,     // Default for other contracts
  },
  arbitrum: {
    default: 150000000,    // All contracts start here
  },
}

// Event filtering
import { excludeEvents } from 'zonder/eventFilters';
contracts: {
  MyContract: excludeEvents(MyContractABI, ['Debug']),
}
```

## Generated Files

| File                    | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `config.yaml`           | Network and contract configuration           |
| `schema.graphql`        | GraphQL entity definitions (for Envio)       |
| `src/EventHandlers.ts`  | Event processors (write to ClickHouse)       |
| `src/clickhouse.ts`     | ClickHouse client with batching + Effect API |
| `clickhouse-schema.sql` | ClickHouse DDL (database + tables)           |
| `.env.example`          | Environment template (credentials + tuning)  |

## Environment Variables

```bash
# ClickHouse connection
CLICKHOUSE_URL=https://your-host:8443
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=your-password
CLICKHOUSE_DATABASE=your_db

# Performance tuning
MAX_BATCH_SIZE=5000                    # Flush after N events
CLICKHOUSE_FLUSH_INTERVAL_MS=5000      # Flush every N ms
CLICKHOUSE_BATCH_ENABLED=true          # Enable batching
```

## Use Cases

- Event data analytics and monitoring
- Raw blockchain data extraction
- Quick prototyping of indexers
- Multi-chain data collection

## License

MIT © Objective Labs

## Related Projects

- [Envio](https://envio.dev) - High-performance indexing with HyperSync
- [Viem](https://viem.sh) - TypeScript Ethereum client library
