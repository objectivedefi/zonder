import { AddressConfig, ChainConfig, ContractConfig, factory } from 'ponder';
import type { Chain as ViemChain } from 'viem';

import type { ZonderConfig } from './zonder.js';

export type BuildConfigReturnType = {
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
): AddressConfig {
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
      throw new Error(
        `Contract ${String(contract)} is configured as a factory-deployed contract on chain ${String(chainName)}, but the factory ${String(deployedBy)} is not configured`,
      );
    }

    return {
      address: factory({
        address: factoryAddress,
        event,
        parameter,
      }),
    };
  }

  throw new Error(`Contract ${String(contract)} is not configured on chain ${String(chainName)}`);
}

export function buildContractConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>, contract: keyof TContracts): ContractConfig {
  const { chains, contracts, startBlocks } = config;

  const ponderChain = Object.fromEntries(
    Object.entries(chains).map(([chainName]) => [
      chainName,
      {
        ...buildContractChainAddressConfig(config, chainName, contract),
        startBlock: startBlocks[chainName],
      },
    ]),
  );

  return {
    abi: contracts[contract],
    chain: ponderChain,
  };
}

export function buildConfig<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>): BuildConfigReturnType {
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
