import type { Abi, AbiEvent, Address, Chain as ViemChain } from 'viem';

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
  startBlocks?: {
    [K in keyof TChains]?: {
      [contractName: string]: number;
    } & {
      default?: number;
    };
  };
  clickhouse?: {
    enabled?: boolean; // default: true
    batchSize?: number; // default: 5000
    flushIntervalMs?: number; // default: 5000
    databaseName?: string; // default: 'default'
  };
};
