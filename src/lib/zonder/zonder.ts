import type { Abi, Chain as ViemChain } from 'viem';

import { type ZonderConfig } from './types.js';
import { validateZonderConfig } from './validateConfig.js';

export function zonder<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>): ZonderConfig<TChains, TContracts> {
  validateZonderConfig(config);

  return config;
}
