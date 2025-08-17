import * as fs from 'fs';
import * as path from 'path';

interface FoundryOutput {
  abi: any[];
}

export function extractAbiFromFoundryOutput(foundryJsonPath: string): any[] | null {
  try {
    const content = fs.readFileSync(foundryJsonPath, 'utf8');
    const foundryOutput: FoundryOutput = JSON.parse(content);
    return foundryOutput.abi;
  } catch (error) {
    console.error(`Error reading ${foundryJsonPath}:`, (error as Error).message);
    return null;
  }
}

export function generateTypeScriptAbiFile(abi: any[], contractName: string): string {
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

export function extractSpecificContract(
  foundryOutDir: string,
  contractName: string,
  outputDir: string,
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
    return false;
  }

  const abi = extractAbiFromFoundryOutput(contractJsonPath);
  if (!abi || abi.length === 0) {
    console.error(`No ABI found for ${contractName}`);
    return false;
  }

  const tsContent = generateTypeScriptAbiFile(abi, contractName);
  const outputPath = path.join(outputDir, `${contractName}.ts`);

  fs.writeFileSync(outputPath, tsContent);
  console.log(`Generated: ${outputPath}`);
  return true;
}

export function extractMultipleContracts(
  foundryOutDir: string,
  contractNames: string[],
  outputDir: string = './abis',
): void {
  const foundryOutDirResolved = path.resolve(foundryOutDir);
  const outputDirResolved = path.resolve(outputDir);

  console.log(`Extracting from: ${foundryOutDirResolved}`);
  console.log(`Contracts: ${contractNames.join(', ')}`);
  console.log(`Output directory: ${outputDirResolved}`);

  let successCount = 0;
  let failCount = 0;

  for (const contractName of contractNames) {
    const success = extractSpecificContract(foundryOutDirResolved, contractName, outputDirResolved);
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
