import * as fs from 'fs';
import * as path from 'path';
import { Abi } from 'viem';

import { safeWriteFileSync } from '../utils/safeWrite.js';

interface FoundryOutput {
  abi: Abi;
}

export function takeAbiFromFoundryOutput(foundryJsonPath: string): Abi | null {
  try {
    const content = fs.readFileSync(foundryJsonPath, 'utf8');
    const foundryOutput: FoundryOutput = JSON.parse(content);
    return foundryOutput.abi;
  } catch (error) {
    console.error(`Error reading ${foundryJsonPath}:`, (error as Error).message);
    return null;
  }
}

export function generateTypeScriptAbiFile(abi: Abi): string {
  const formattedAbi = JSON.stringify(abi, null, 2);
  return `export default ${formattedAbi} as const;\n`;
}

function findContractFile(dirPath: string, targetContract: string): string | null {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const found = findContractFile(fullPath, targetContract);
      if (found) return found;
    } else if (entry.name === `${targetContract}.json`) {
      return fullPath;
    }
  }
  return null;
}

function findAllContractFiles(dirPath: string): string[] {
  const contracts: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return contracts;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      contracts.push(...findAllContractFiles(fullPath));
    } else if (entry.name.endsWith('.json')) {
      const contractName = entry.name.replace('.json', '');
      contracts.push(contractName);
    }
  }

  return contracts;
}

export function extractSpecificContract(
  foundryOutDir: string,
  contractName: string,
  outputDir: string,
  overwrite: boolean = false,
): boolean {
  if (!fs.existsSync(foundryOutDir)) {
    console.error(`Foundry output directory not found: ${foundryOutDir}`);
    return false;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const contractJsonPath = findContractFile(foundryOutDir, contractName);

  if (!contractJsonPath) {
    console.error(`Contract ${contractName}.json not found in ${foundryOutDir}`);

    // Show available contracts
    const availableContracts = findAllContractFiles(foundryOutDir);
    if (availableContracts.length > 0) {
      const sortedContracts = [...new Set(availableContracts)].sort();
      console.log('\n💡 Available contracts:');
      sortedContracts.forEach((contract) => {
        console.log(`  - ${contract}`);
      });
      console.log(
        `\n💡 Usage: pnpm zonder take-abi ${foundryOutDir} ${sortedContracts.slice(0, 3).join(' ')}`,
      );
    }

    return false;
  }

  const abi = takeAbiFromFoundryOutput(contractJsonPath);
  if (!abi || abi.length === 0) {
    console.error(`No ABI found for ${contractName}`);
    return false;
  }

  const tsContent = generateTypeScriptAbiFile(abi);
  const outputPath = path.join(outputDir, `${contractName}.ts`);

  safeWriteFileSync(outputPath, tsContent, { overwrite });
  return true;
}

export function extractMultipleContracts(
  foundryOutDir: string,
  contractNames: string[],
  outputDir: string = './abis',
  overwrite: boolean = false,
): void {
  const foundryOutDirResolved = path.resolve(foundryOutDir);
  const outputDirResolved = path.resolve(outputDir);
  // Check if foundry out directory exists
  if (!fs.existsSync(foundryOutDirResolved)) {
    console.error(`❌ Foundry output directory not found: ${foundryOutDirResolved}`);
    console.log('💡 Make sure you have run "forge build" in your Foundry project first.');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const contractName of contractNames) {
    const success = extractSpecificContract(
      foundryOutDirResolved,
      contractName,
      outputDirResolved,
      overwrite,
    );
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\nExtraction completed: ${successCount} succeeded, ${failCount} failed`);
  if (failCount > 0) {
    process.exit(1);
  }
}

export async function takeAbi(
  outDir: string,
  contracts: string[],
  overwrite: boolean = false,
): Promise<void> {
  return extractMultipleContracts(outDir, contracts, './abis', overwrite);
}
