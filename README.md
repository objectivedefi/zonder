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
// File: abis/EVault.abi
export default [...] as const;
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
  startBlocks: { mainnet: 20000000 },
} as const satisfies ZonderConfig<any, any>;

export default zonder(zonderConfig);
```

```bash
# 5. Generate schema and event handlers
pnpm zonder generate

# 6. Start indexing
pnpm ponder dev
```

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
