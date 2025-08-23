import fs from 'fs';
import * as yaml from 'js-yaml';
import type { Abi } from 'viem';

import { resolveMinStartBlock, resolveStartBlock } from '../zonder/resolveStartBlock.js';
import type { ZonderConfig } from '../zonder/types.js';
import { formatEventSignature } from './formatEventSignature.js';

export interface EnvioConfig {
  name: string;
  description?: string;
  ecosystem?: 'evm';
  field_selection?: {
    transaction_fields?: string[];
    block_fields?: string[];
    log_fields?: string[];
  };
  contracts?: Array<{
    name: string;
    abi?: string;
    handler: string;
    events: Array<{
      event: string;
      name?: string;
    }>;
  }>;
  networks: Array<{
    id: number;
    start_block: number;
    contracts: Array<{
      name: string;
      address: string | string[];
      start_block?: number;
    }>;
  }>;
  unordered_multichain_mode?: boolean;
  event_decoder?: 'viem' | 'hypersync-client';
  rollback_on_reorg?: boolean;
}

export function generateEnvioConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>, projectName = 'zonder-indexer') {
  const envioConfig: EnvioConfig = {
    name: projectName,
    description: 'Auto-generated Envio configuration from Zonder',
    field_selection: {
      transaction_fields: ['hash'],
    },
    contracts: [],
    networks: [],
    unordered_multichain_mode: true,
  };

  // Process contracts
  Object.entries(config.contracts || {}).forEach(([contractName, abi]) => {
    const events = abi.filter((item) => item.type === 'event');

    if (envioConfig.contracts && events.length > 0) {
      envioConfig.contracts.push({
        name: contractName,
        handler: `./src/EventHandlers.ts`,
        events: events.map((event) => ({
          event: formatEventSignature(event),
        })),
      });
    }
  });

  // Process networks
  Object.entries(config.chains || {}).forEach(([chainName, chain]) => {
    const chainId = (chain as any).id;
    const addresses = config.addresses?.[chainName as keyof typeof config.addresses];

    const networkContracts: Array<{
      name: string;
      address: string | string[];
      start_block?: number;
    }> = [];

    // Find minimum start block for chain using resolver
    const minStartBlock = resolveMinStartBlock(config.startBlocks, chainName, addresses);

    Object.entries(addresses || {}).forEach(([contractName, address]) => {
      if (address) {
        const contractStartBlock = resolveStartBlock(config.startBlocks, chainName, contractName);

        // Check if this is a factory-deployed contract
        const factoryConfig = config.factoryDeployed?.[contractName];
        if (factoryConfig) {
          // For factory-deployed contracts in Envio, don't specify address
          // They will be registered dynamically via contractRegister handlers
          // Skip adding to network contracts here
          return;
        } else {
          networkContracts.push({
            name: contractName,
            address: Array.isArray(address) ? address : [address],
            // Always include start_block for clarity
            start_block: contractStartBlock,
          });
        }
      }
    });

    if (networkContracts.length > 0) {
      envioConfig.networks.push({
        id: chainId,
        start_block: minStartBlock, // Use minimum start block as chain start block
        contracts: networkContracts,
      });
    }
  });

  // Convert to YAML
  const yamlContent = yaml.dump(envioConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  // Add schema reference at the top
  const schemaHeader = '# yaml-language-server: $schema=./node_modules/envio/evm.schema.json\n';
  return schemaHeader + yamlContent;
}

// Script wrapper for CLI usage
export function generateAndWriteEnvioConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, Abi>,
>(
  config: ZonderConfig<TChains, TContracts>,
  outputPath = 'config.yaml',
  projectName = 'zonder-indexer',
) {
  const yamlContent = generateEnvioConfig(config, projectName);
  fs.writeFileSync(outputPath, yamlContent);
}
