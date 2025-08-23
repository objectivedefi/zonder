import fs from 'fs';
import type { Abi } from 'viem';

import type { ZonderConfig } from '../zonder/types.js';
import { formatEventSignature } from './formatEventSignature.js';

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
function replacer(_: string, value: any) {
  if (typeof value === "bigint") {
    return \`\${value.toString()}n\`;
  }
  return value;
}

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
      if (Array.isArray(value)) {
        acc[\`evt_\${key}\`] = JSON.stringify(value, replacer);
      } else {
        acc[\`evt_\${key}\`] = value;
      }
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

  /**
   * Generates factory contract registration handlers
   */
  function generateFactoryRegistrations<
    TChains extends Record<string, any>,
    TContracts extends Record<string, Abi>,
  >(config: ZonderConfig<TChains, TContracts>): string {
    if (!config.factoryDeployed) {
      return '';
    }

    const factoryRegistrations: string[] = [];

    Object.entries(config.factoryDeployed).forEach(([contractName, factoryConfig]) => {
      if (!factoryConfig) return;

      // Only generate registration if the deployed contract has events to index
      const deployedContractAbi = config.contracts[contractName];
      const hasEvents = deployedContractAbi?.some((item: any) => item.type === 'event');

      if (!hasEvents) {
        // Skip registration for contracts with no events - pointless to register them
        return;
      }

      const { event, parameter, deployedBy } = factoryConfig;
      const eventSignature = formatEventSignature(event);
      const factoryContractName = String(deployedBy);

      // Generate the contractRegister handler
      const registration = `
// Factory contract registration for ${contractName}
${factoryContractName}.${eventSignature.split('(')[0]}.contractRegister(({ event, context }) => {
  const deployedAddress = event.params.${parameter};
  context.add${contractName}(deployedAddress);
});`;

      factoryRegistrations.push(registration);
    });

    return factoryRegistrations.join('\n') + (factoryRegistrations.length > 0 ? '\n' : '');
  }

  // Generate factory contract registrations
  const factoryRegistrations = generateFactoryRegistrations(config);

  // Generate registration for each contract
  const registrations = contractsWithEvents
    .map(
      (contractName) => `
Object.entries(${contractName}).forEach(([eventName, { handler }]) =>
  registerHandler(handler, "${contractName}", eventName)
);`,
    )
    .join('\n');

  return imports + helperFunctions + factoryRegistrations + registrations + '\n';
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
