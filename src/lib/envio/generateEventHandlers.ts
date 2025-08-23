import fs from 'fs';
import type { Abi } from 'viem';

import type { ZonderConfig } from '../zonder/types.js';
import { solidityTypeToGraphQLType } from './solidityTypeToGraphQLType.js';

/**
 * Generates event handlers for Envio
 */
export function generateEventHandlers<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>): string {
  // Get all contract names that have events
  const contractsWithEvents = Object.entries(config.contracts || {})
    .filter(([, abi]) => abi.some((item) => item.type === 'event'))
    .map(([name]) => name);

  if (contractsWithEvents.length === 0) {
    return '';
  }

  // Build imports
  const imports = `import { ${contractsWithEvents.join(', ')}, EventLog } from "generated";\n`;

  // Helper functions (kept as-is)
  const helperFunctions = `
function extractEventParams<params extends { [key: string]: any }>(
  event: EventLog<params>
) {
  const id = \`\${event.chainId}_\${event.block.number}_\${event.logIndex}\`;

  const baseParams = {
    id,
    chainId: event.chainId,
    txHash: event.transaction.hash,
    blockNumber: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
    logIndex: event.logIndex,
    logAddress: event.srcAddress,
  };

  const eventParams = Object.entries(event.params ?? {}).reduce(
    (acc, [key, value]) => {
      acc[\`evt_\${key}\`] = value;
      return acc;
    },
    {} as Record<string, any>
  );

  return {
    ...baseParams,
    ...eventParams,
  };
}

export function registerHandler(
  handler: any,
  contractName: string,
  eventName: string
) {
  return handler(async ({ event, context }: any) => {
    const contextKey = \`\${contractName}_\${eventName}\`;
    context[contextKey].set(extractEventParams(event));
  });
}
`;

  // Generate registration for each contract
  const registrations = contractsWithEvents
    .map(
      (contractName) => `
Object.entries(${contractName}).forEach(([eventName, { handler }]) =>
  registerHandler(handler, "${contractName}", eventName)
);`,
    )
    .join('\n');

  return imports + helperFunctions + registrations + '\n';
}

/**
 * Generates and writes event handlers to file
 */
export function generateAndWriteEventHandlers<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>, outputPath = 'src/EventHandlers.ts') {
  const handlersContent = generateEventHandlers(config);

  // Ensure directory exists
  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, handlersContent);
  return handlersContent;
}
