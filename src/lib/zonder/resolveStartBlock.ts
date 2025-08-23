import { ZonderConfig } from './types.js';

export function resolveStartBlock<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(
  startBlocks: ZonderConfig<TChains, TContracts>['startBlocks'],
  chainName: string,
  contractName: string,
): number {
  // If no startBlocks config at all, default to 0
  if (!startBlocks) {
    return 0;
  }

  const chainStartBlocks = startBlocks[chainName];

  // If no config for this chain, default to 0
  if (!chainStartBlocks) {
    return 0;
  }

  // Per-contract start blocks with default fallback (default to 0 if not specified)
  return chainStartBlocks[contractName] ?? chainStartBlocks.default ?? 0;
}

/**
 * Resolves the chain-level start blocks, returning a safe object with defaults
 */
export function resolveChainStartBlocks<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(
  startBlocks: ZonderConfig<TChains, TContracts>['startBlocks'],
  chainName: string,
): { [contractName: string]: number; default: number } {
  if (!startBlocks || !startBlocks[chainName]) {
    return { default: 0 };
  }

  const chainStartBlocks = startBlocks[chainName];
  return {
    ...chainStartBlocks,
    default: chainStartBlocks.default ?? 0,
  };
}

/**
 * Gets the minimum start block for a chain across all contracts
 */
export function resolveMinStartBlock<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(
  startBlocks: ZonderConfig<TChains, TContracts>['startBlocks'],
  chainName: string,
  addresses: Record<string, any>,
): number {
  if (!startBlocks || !startBlocks[chainName] || !addresses) {
    return 0;
  }

  const chainStartBlocks = startBlocks[chainName];
  const defaultStartBlock = chainStartBlocks.default ?? 0;
  let minStartBlock = defaultStartBlock;

  // Check all contracts that have addresses on this chain
  for (const [contractName, address] of Object.entries(addresses)) {
    if (address) {
      const contractStartBlock = chainStartBlocks[contractName] ?? defaultStartBlock;
      if (contractStartBlock < minStartBlock) {
        minStartBlock = contractStartBlock;
      }
    }
  }

  return minStartBlock;
}
