import fs from 'fs';
import type { Abi } from 'viem';

import { safeWriteFileSync } from '../utils/safeWrite.js';
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
  const imports = `import { ${contractsWithEvents.join(', ')} } from "generated";\n`;

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

  // Generate individual registration for each event in each contract
  const registrations: string[] = [];

  Object.entries(config.contracts || {}).forEach(([contractName, abi]) => {
    const events = abi.filter((item) => item.type === 'event');

    events.forEach((event) => {
      const eventName = event.name;

      // Build event parameter assignments
      const eventParams =
        event.inputs
          ?.map((input) => {
            const paramName = input.name || 'param';
            if (input.type.startsWith('tuple') || input.type.includes('[')) {
              // For complex types (arrays, tuples), stringify them
              return `    evt_${paramName}: JSON.stringify(event.params.${paramName}, (_, v) => typeof v === 'bigint' ? \`\${v.toString()}n\` : v),`;
            } else {
              return `    evt_${paramName}: event.params.${paramName},`;
            }
          })
          .join('\n') || '';

      registrations.push(`
${contractName}.${eventName}.handler(async ({ event, context }) => {
  context.${contractName}_${eventName}.set({
    id: \`\${event.chainId}_\${event.block.number}_\${event.logIndex}\`,
    chainId: event.chainId,
    txHash: event.transaction.hash,
    blockNumber: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
    logIndex: event.logIndex,
    logAddress: event.srcAddress,${eventParams ? '\n' + eventParams : ''}
  });
});`);
    });
  });

  return imports + factoryRegistrations + registrations.join('\n') + '\n';
}

/**
 * Generates and writes event handlers to file
 */
export function generateAndWriteEventHandlers<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(
  config: ZonderConfig<TChains, TContracts>,
  outputPath = 'src/EventHandlers.ts',
  overwrite = false,
) {
  const handlersContent = generateEventHandlers(config);

  // Ensure directory exists
  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  safeWriteFileSync(outputPath, handlersContent, { overwrite });
  return handlersContent;
}
