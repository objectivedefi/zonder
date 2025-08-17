# Zonder

Ergonomic Ponder framework for multichain event extraction.

> [!WARNING]
> Pre-production API: expect breaking changes

## Quick Start

```bash
# 1. Init new Ponder project
pnpm ponder create my-indexer

# 2. Install Zonder
pnpm add zonder
```

```typescript
// 3. Add your ABIs in abis/
// File: abis/EVault.ts (note: .ts extension, not .abi)
export default [...] as const;

// 💡 Use `pnpm zonder take-abi` to extract from Foundry (recommended)
```

```typescript
// 4. Configure ponder.config.ts
import { mainnet } from 'viem/chains';
import { ZonderConfig, zonder } from 'zonder';

import EVault from './abis/EVault';

export const zonderConfig = {
  chains: { mainnet },
  contracts: { EVault },
  addresses: { mainnet: { EVault: '0x...' } },
  startBlocks: { mainnet: { default: 20000000 } },
} as const satisfies ZonderConfig<any, any>;

export default zonder(zonderConfig);
```

```bash
# 5. Auto-discover deployment blocks (recommended)
pnpm zonder find-start-blocks
# Copy the output to your startBlocks config

# 6. Generate schema and event handlers
pnpm zonder generate

# 7. Start indexing
pnpm ponder dev
```

## CLI Commands

### `generate`

Generate Ponder schema and event handlers from your config:

```bash
pnpm zonder generate
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

- **Zero transformations**: Raw event storage for maximum speed
- **Analytics-ready schemas**: Pre-optimized indexes for time-series queries
- **Multi-chain by default**: Same config works across all chains
- **Factory contract support**: Auto-track factory-deployed contracts
- **Type-safe configuration**: Full TypeScript support

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

## What Gets Generated

**Schema** (`ponder.schema.ts`): Tables with metadata + event args, pre-optimized indexes for analytics

**Handlers** (`src/index.ts`): Auto-generated event handlers that save all events raw to database

## Why Zonder?

| Vanilla Ponder                       | Zonder                               |
| ------------------------------------ | ------------------------------------ |
| Write custom handlers for each event | Auto-generated raw event storage     |
| Transform data in handlers           | Zero transformations = maximum speed |
| Design schemas per use case          | Pre-optimized analytics schemas      |
| Hours to days setup                  | Minutes                              |

**Best for**: High-volume analytics, monitoring, data lakes where you need complete raw event data fast.

**Not for**: Custom business logic, complex transformations, application-specific data models.

## License

MIT © Objective Labs

## Related Projects

- [Ponder](https://ponder.sh) - The underlying indexing framework
- [Viem](https://viem.sh) - Ethereum client library
- [Drizzle ORM](https://orm.drizzle.team) - Database ORM used by Ponder
