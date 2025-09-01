import fs from 'fs';
import type { Abi } from 'viem';

import { safeWriteFileSync } from '../utils/safeWrite.js';
import type { ZonderConfig } from '../zonder/types.js';
import { formatEventName } from './formatEventName.js';
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

    // Group contracts by their factory event
    const factoryEvents: Record<string, Array<{ contractName: string; parameter: string }>> = {};

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

      // Group by full signature to prevent overload collisions
      const groupKey = `${factoryContractName}.${eventSignature}`;
      (factoryEvents[groupKey] ??= []).push({ contractName, parameter });
    });

    // Generate contractRegister handlers
    const factoryRegistrations = Object.entries(factoryEvents).map(([groupKey, contracts]) => {
      const eventKey = groupKey.slice(0, groupKey.indexOf('(')); // "Factory.EventName"
      const isSingle = contracts.length === 1;
      const contractNames = contracts.map((c) => c.contractName).join(' and ');

      const body = isSingle
        ? `  const deployedAddress = event.params.${contracts[0].parameter};
  context.add${contracts[0].contractName}(deployedAddress);`
        : contracts
            .map(({ parameter }) => `  const ${parameter}Address = event.params.${parameter};`)
            .join('\n') +
          '\n' +
          contracts
            .map(
              ({ contractName, parameter }) => `  context.add${contractName}(${parameter}Address);`,
            )
            .join('\n');

      return `
// Factory contract registration for ${contractNames}
${eventKey}.contractRegister(({ event, context }) => {
${body}
});`;
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
              return `    evt_${formatEventName(paramName)}: JSON.stringify(event.params.${paramName}, (_, v) => typeof v === 'bigint' ? \`\${v.toString()}n\` : v),`;
            } else {
              return `    evt_${formatEventName(paramName)}: event.params.${paramName},`;
            }
          })
          .join('\n') || '';

      registrations.push(`
${contractName}.${eventName}.handler(async ({ event, context }) => {
  context.${contractName}_${eventName}.set({
    id: \`\${event.chainId}_\${event.block.number}_\${event.logIndex}\`,
    chain_id: event.chainId,
    tx_hash: event.transaction.hash,
    block_number: BigInt(event.block.number),
    block_timestamp: BigInt(event.block.timestamp),
    log_index: event.logIndex,
    log_address: event.srcAddress,${eventParams ? '\n' + eventParams : ''}
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
