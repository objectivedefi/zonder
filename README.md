# Zonder

Multi-chain indexing config generator for Ponder and Envio.

> [!WARNING]
> Pre-production API: expect breaking changes

## Quick Start

Choose one indexing backend: Ponder or Envio.

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
# 5. Generate files
pnpm zonder generate envio
# Creates: config.yaml, schema.graphql, src/EventHandlers.ts, .env.example

# 6. Configure DB (copy .env.example to .env.local and fill values)
cp .env.example .env.local

# 7. Generate envio internals
pnpm envio codegen

# 8. Run
pnpm envio start
```

### Zonder + Ponder

```bash
# 1. Initialize Ponder (choose Default template)
pnpm create ponder my-indexer
cd my-indexer

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
# 5. Auto-discover deployment blocks (recommended)
pnpm zonder find-start-blocks

# 6. Generate files
pnpm zonder generate ponder
# Creates: ponder.config.ts, ponder.schema.ts, src/index.ts, .env.example

# 7. Configure RPC URLs (copy .env.example to .env.local and add RPC URLs)
cp .env.example .env.local

# 8. Start indexing
pnpm ponder dev
```

## CLI Commands

### `generate <runtime>`

Generate indexer files for your chosen runtime:

```bash
# For Ponder
pnpm zonder generate ponder
# Generates: ponder.config.ts, ponder.schema.ts, src/index.ts, .env.example

# For Envio
pnpm zonder generate envio
# Generates: config.yaml, schema.graphql, src/EventHandlers.ts, .env.example
```

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

- Generate files for Ponder or Envio from unified config
- Raw event storage with optimized indexes
- Multi-chain configuration support
- Factory contract support for dynamically deployed contracts
- TypeScript configuration with type safety
- Auto-generated environment templates

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

## Runtime Comparison

| Feature      | Ponder             | Envio                 |
| ------------ | ------------------ | --------------------- |
| **Database** | SQLite or Postgres | Postgres              |
| **Sync**     | Standard RPC       | HyperSync + RPC       |
| **Language** | TypeScript         | TypeScript + ReScript |

### Generated Files

**Ponder**:

- `ponder.config.ts`: Runtime configuration
- `ponder.schema.ts`: Drizzle ORM tables with indexes
- `src/index.ts`: Event handlers for raw storage
- `.env.example`: RPC URL templates

**Envio**:

- `config.yaml`: Network and contract configuration
- `schema.graphql`: GraphQL entity definitions
- `src/EventHandlers.ts`: Event processors
- `.env.example`: Database and performance settings

## Use Cases

**Suitable for**:

- Event data analytics and monitoring
- Raw blockchain data extraction
- Quick prototyping of indexers
- Multi-chain data collection

**Not suitable for**:

- Complex data transformations
- Custom business logic
- Application-specific data models

## License

MIT © Objective Labs

## Related Projects

- [Ponder](https://ponder.sh) - TypeScript indexing framework
- [Envio](https://envio.dev) - High-performance indexing with HyperSync
- [Viem](https://viem.sh) - TypeScript Ethereum client library
- [Drizzle ORM](https://orm.drizzle.team) - Database ORM used by Ponder
