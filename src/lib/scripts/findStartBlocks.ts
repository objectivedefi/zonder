import * as fs from 'fs';
import {
  type Address,
  type PublicClient,
  type Chain as ViemChain,
  createPublicClient,
  http,
} from 'viem';

import type { ZonderConfig } from '../zonder/types.js';
import { findDeploymentBlock } from './findDeploymentBlock.js';

interface DeploymentResults {
  [chainName: string]: {
    [contractName: string]: number;
  };
}

function createClientForChain(chain: ViemChain): PublicClient {
  const chainId = chain.id;
  const envVarName = `PONDER_RPC_URL_${chainId}`;
  const rpcUrl = process.env[envVarName];

  if (!rpcUrl) {
    throw new Error(`Environment variable ${envVarName} is not set for chain ${chain.name}`);
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

function hasSpecificStartBlock<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, any>,
>(
  config: ZonderConfig<TChains, TContracts>,
  chainName: keyof TChains,
  contractName: string,
): boolean {
  if (!config.startBlocks) return false;
  const chainStartBlocks = config.startBlocks[chainName];
  if (!chainStartBlocks) return false;

  // Check if this contract has a specific start block (not just using default)
  return chainStartBlocks[contractName] !== undefined;
}

function writeDeploymentBlocks(results: DeploymentResults): void {
  try {
    fs.writeFileSync('start-blocks.json', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Failed to write start-blocks.json:', error);
  }
}

export async function findAllDeploymentBlocks<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>): Promise<DeploymentResults> {
  const results: DeploymentResults = {};

  // Pre-populate with existing start blocks from config
  if (config.startBlocks) {
    for (const [chainName, chainStartBlocks] of Object.entries(config.startBlocks)) {
      if (chainStartBlocks) {
        results[chainName] = {};
        for (const [contractName, blockNumber] of Object.entries(chainStartBlocks)) {
          if (contractName !== 'default' && typeof blockNumber === 'number') {
            results[chainName][contractName] = blockNumber;
          }
        }
      }
    }
  }

  // Initialize start-blocks.json with existing blocks
  writeDeploymentBlocks(results);

  // Get all chain names from the config
  const chainNames = Object.keys(config.addresses) as (keyof TChains)[];

  console.log(`Processing ${chainNames.length} chains: ${chainNames.join(', ')}`);

  for (const chainName of chainNames) {
    console.log(`\n${String(chainName)}:`);
    if (!results[String(chainName)]) {
      results[String(chainName)] = {};
    }

    try {
      const chain = config.chains[chainName];
      if (!chain) {
        console.error(`Chain ${String(chainName)} not found in config`);
        continue;
      }

      const client = createClientForChain(chain);
      const addresses = config.addresses[chainName];

      if (!addresses) {
        console.log(`  No addresses configured for ${String(chainName)}`);
        continue;
      }

      const addressEntries = Object.entries(addresses);
      const latestBlock = await client.getBlockNumber();

      for (const [contractName, address] of addressEntries) {
        if (!address) {
          continue;
        }

        // Skip if this contract already has a specific start block configured
        if (hasSpecificStartBlock(config, chainName, contractName)) {
          console.log(`  ${contractName}: already configured, skipping`);
          continue;
        }

        // Handle both single address and array of addresses
        const addressesToProcess = Array.isArray(address) ? address : [address];

        process.stdout.write(`  ${contractName}: `);

        for (let i = 0; i < addressesToProcess.length; i++) {
          const currentAddress = addressesToProcess[i];

          try {
            const deploymentBlock = await findDeploymentBlock(
              client,
              currentAddress as Address,
              latestBlock,
            );

            if (deploymentBlock !== null) {
              const blockNumber = Number(deploymentBlock);
              // For arrays, use the earliest deployment block
              const chainResults = results[String(chainName)];
              if (
                chainResults &&
                (chainResults[contractName] === undefined ||
                  blockNumber < chainResults[contractName])
              ) {
                chainResults[contractName] = blockNumber;
                // Write to file immediately after discovering each block
                writeDeploymentBlocks(results);
              }
              console.log(blockNumber);
              break; // Found deployment block, no need to check other addresses
            }
          } catch (error) {
            // Silent error handling, continue to next address
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // If no deployment block found for any address
        const chainResults = results[String(chainName)];
        if (chainResults && !chainResults[contractName]) {
          console.log('not found');
        }
      }
    } catch (error) {
      console.error(`Failed to process ${String(chainName)}: ${error}`);
    }
  }

  return results;
}
