import { isAddress } from 'viem';
import type { Abi, AbiEvent, Address, Chain as ViemChain } from 'viem';

import { BuildConfigReturnType, buildConfig } from './buildConfig.js';

export type ZonderConfig<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, Abi>,
> = {
  chains: TChains;
  contracts: TContracts;
  addresses: {
    [K in keyof TChains]: Partial<Record<keyof TContracts, Address | Address[]>>;
  };
  factoryDeployed?: Partial<
    Record<
      keyof TContracts,
      {
        event: AbiEvent;
        parameter: string;
        deployedBy: keyof TContracts;
      }
    >
  >;
  startBlocks: {
    [K in keyof TChains]: {
      [contractName: string]: number;
      default: number;
    };
  };
};

function validateZonderConfig<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>) {
  const chainNames = Object.keys(config.chains);
  const contractNames = Object.keys(config.contracts);

  // Validate chain references
  const validateChainExists = (chain: string, source: string) => {
    if (!chainNames.includes(chain)) {
      throw new Error(`Chain "${chain}" in ${source} is not defined in chains`);
    }
  };

  Object.keys(config.addresses).forEach((chain) => validateChainExists(chain, 'addresses'));
  Object.keys(config.startBlocks).forEach((chain) => validateChainExists(chain, 'startBlocks'));

  // Validate contract references and addresses
  for (const [chain, chainAddresses] of Object.entries(config.addresses)) {
    for (const [contract, address] of Object.entries(chainAddresses as object)) {
      if (!contractNames.includes(contract)) {
        throw new Error(`Contract "${contract}" in addresses is not defined in contracts`);
      }

      if (address) {
        const addresses = Array.isArray(address) ? address : [address];
        for (const addr of addresses) {
          if (!isAddress(addr)) {
            throw new Error(
              `Invalid address "${addr}" for contract "${contract}" on chain "${chain}". Must be a valid Ethereum address (0x...)`,
            );
          }
        }
      }
    }
  }

  // Validate factoryDeployed references
  if (config.factoryDeployed) {
    for (const [contract, factoryConfig] of Object.entries(config.factoryDeployed)) {
      if (!contractNames.includes(contract)) {
        throw new Error(`Contract "${contract}" in factoryDeployed is not defined in contracts`);
      }
      if (factoryConfig && !contractNames.includes(String(factoryConfig.deployedBy))) {
        throw new Error(
          `Factory "${String(factoryConfig.deployedBy)}" referenced by "${contract}" is not defined in contracts`,
        );
      }
    }
  }
}

export function zonder<
  TChains extends Record<string, ViemChain>,
  TContracts extends Record<string, Abi>,
>(config: ZonderConfig<TChains, TContracts>): BuildConfigReturnType {
  validateZonderConfig(config);

  let builtConfig: BuildConfigReturnType | null = null;

  return new Proxy({} as BuildConfigReturnType, {
    get(target, prop) {
      if (!builtConfig) {
        builtConfig = buildConfig(config);
      }
      return builtConfig[prop as keyof BuildConfigReturnType];
    },
  });
}
