import type { Abi, Chain as ViemChain } from 'viem';

import { type PonderBuildConfigReturnType, buildConfig } from '../ponder/index.js';
import { type ZonderConfig } from './types.js';
import { validateZonderConfig } from './validateConfig.js';

type ZonderResult<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, Abi>,
> = ZonderConfig<TChains, TContracts> & {
  toPonder(): PonderBuildConfigReturnType;
};

export function zonder<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>): ZonderResult<TChains, TContracts> {
  validateZonderConfig(config);

  return {
    ...config,
    toPonder() {
      let builtConfig: PonderBuildConfigReturnType | null = null;

      return new Proxy({} as PonderBuildConfigReturnType, {
        get(_, prop) {
          if (!builtConfig) {
            builtConfig = buildConfig(config);
          }
          return builtConfig[prop as keyof PonderBuildConfigReturnType];
        },
      });
    },
  };
}
