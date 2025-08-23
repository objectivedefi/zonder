import { AddressConfig, ChainConfig, ContractConfig, factory } from 'ponder';
import type { Chain as ViemChain } from 'viem';

import { resolveStartBlock } from '../zonder/resolveStartBlock.js';
import type { ZonderConfig } from '../zonder/types.js';

export type PonderBuildConfigReturnType = {
  chains: Record<string, ChainConfig>;
  contracts: Record<string, ContractConfig>;
};

export function buildChains(chains: Record<string, ViemChain>) {
  return Object.fromEntries(
    Object.entries(chains).map(([chainName, chain]) => {
      const rpcKey = `PONDER_RPC_URL_${chain.id}`;
      const rpcValue = process.env[rpcKey];
      if (!rpcValue) {
        throw new Error(`${rpcKey} is not set`);
      }

      const rpc = rpcValue.split(',');
      if (rpc.length === 0) {
        throw new Error(`${rpcKey} is empty`);
      }

      rpc.forEach((r) => {
        try {
          new URL(r);
        } catch (e) {
          throw new Error(`${rpcKey} contains invalid URL: "${r}"`);
        }
      });

      return [
        chainName,
        {
          id: chain.id,
          rpc,
        },
      ];
    }),
  );
}

export function buildContractChainAddressConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(
  config: ZonderConfig<TChains, TContracts>,
  chainName: keyof TChains,
  contract: keyof TContracts,
): AddressConfig | null {
  const { factoryDeployed, addresses } = config;
  const address = addresses[chainName][contract];
  const factoryConfig = factoryDeployed?.[contract];

  if (!!address && !!factoryConfig) {
    throw new Error(
      `Contract ${String(contract)} is configured both as a singleton and a factory on chain ${String(chainName)}`,
    );
  }

  if (address) {
    return { address };
  }

  if (factoryConfig) {
    const { event, parameter, deployedBy } = factoryConfig;
    const factoryAddress = addresses[chainName][deployedBy];
    if (!factoryAddress) {
      // Factory not configured on this chain - factory-deployed contract can't exist here
      return null;
    }

    return {
      address: factory({
        address: factoryAddress,
        event,
        parameter,
      }),
    };
  }

  // Contract not configured on this chain - this is acceptable
  return null;
}

export function buildContractConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>, contract: keyof TContracts): ContractConfig {
  const { chains, contracts, startBlocks } = config;

  const ponderChain = Object.fromEntries(
    Object.entries(chains)
      .map(([chainName]) => {
        const addressConfig = buildContractChainAddressConfig(config, chainName, contract);
        if (!addressConfig) {
          // Contract not configured on this chain, skip it
          return null;
        }
        return [
          chainName,
          {
            ...addressConfig,
            startBlock: resolveStartBlock(startBlocks, chainName, String(contract)),
          },
        ];
      })
      .filter((entry) => entry !== null),
  );

  return {
    abi: contracts[contract],
    chain: ponderChain,
  };
}

export function buildConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>): PonderBuildConfigReturnType {
  return {
    chains: buildChains(config.chains),
    contracts: Object.fromEntries(
      Object.keys(config.contracts).map((contract) => [
        contract,
        buildContractConfig(config, contract as keyof TContracts),
      ]),
    ),
  };
}
