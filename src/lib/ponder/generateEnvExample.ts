import fs from 'fs';

import type { ZonderConfig } from '../zonder/types.js';

export function generatePonderEnvExample<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>): string {
  let content = '';

  // Add RPC URLs for each chain
  Object.entries(config.chains || {}).forEach(([chainName, chain]) => {
    const chainId = (chain as any).id;
    if (chainId) {
      content += `PONDER_RPC_URL_${chainId}=\n`;
    }
  });

  // Add database URL
  content += `
# (Optional) Postgres database URL. If not provided, SQLite will be used.
DATABASE_URL=
`;

  return content;
}

export function generateAndWritePonderEnvExample<
  TChains extends Record<string, any>,
  TContracts extends Record<string, any>,
>(config: ZonderConfig<TChains, TContracts>, outputPath = '.env.example'): void {
  const content = generatePonderEnvExample(config);
  fs.writeFileSync(outputPath, content);
}
