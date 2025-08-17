#!/usr/bin/env node
import { execSync } from 'child_process';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import fs from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

// Get package.json for version sync
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program
  .name('zonder')
  .description('Ergonomic multi-chain indexing framework built on Ponder')
  .version(pkg.version);

program
  .command('generate')
  .description('Generate Ponder schema and event handlers from config')
  .option('-c, --config <path>', 'Path to config file', './ponder.config.ts')
  .option('-s, --schema <path>', 'Schema output file path', './ponder.schema.ts')
  .option('-i, --index <path>', 'Index output file path', './src/index.ts')
  .action(async (options) => {
    try {
      console.log('🔨 Generating Ponder files...');

      // Check if config file exists
      if (!fs.existsSync(options.config)) {
        console.error(`❌ Config file not found: ${options.config}`);
        process.exit(1);
      }

      const configPath = resolve(options.config);
      const schemaPath = resolve(options.schema);
      const indexPath = resolve(options.index);

      // Ensure src directory exists
      const srcDir = dirname(indexPath);
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      // Create a temporary script file to avoid module resolution issues
      const tempFile = join(dirname(configPath), '.zonder-temp-generate.mjs');
      const schemaModulePath = join(__dirname, '../lib/generateSchema.js');
      const indexModulePath = join(__dirname, '../lib/generateIndex.js');

      const scriptContent = `
import { zonderConfig } from '${configPath}';
import { generateAndWriteSchema } from '${schemaModulePath}';
import { generateAndWriteIndex } from '${indexModulePath}';

// Generate schema
await generateAndWriteSchema(zonderConfig.contracts, '${schemaPath}');

// Generate index
await generateAndWriteIndex('${indexPath}');
`;

      fs.writeFileSync(tempFile, scriptContent);

      const command = `npx tsx ${tempFile}`;

      try {
        execSync(command, { stdio: 'inherit', env: process.env });
        console.log('✅ Ponder files generated successfully!');
        console.log(`📄 Schema: ${options.schema}`);
        console.log(`📄 Index: ${options.index}`);
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    } catch (error) {
      console.error('❌ Error generating files:', error);
      process.exit(1);
    }
  });

program
  .command('take-abi')
  .description('Extract ABIs from Foundry build artifacts and generate TypeScript files')
  .argument('<foundry-out-dir>', 'Path to Foundry out directory')
  .argument('<contract-names...>', 'Contract names to extract (e.g., EVault RewardToken)')
  .option('-o, --output <dir>', 'Output directory for ABI files', './abis')
  .action(async (foundryOutDir, contractNames, options) => {
    try {
      console.log('🔨 Extracting ABIs from Foundry artifacts...');

      const { extractMultipleContracts } = await import('../lib/extractAbi.js');
      extractMultipleContracts(foundryOutDir, contractNames, options.output);
    } catch (error) {
      console.error('❌ Error extracting ABIs:', error);
      process.exit(1);
    }
  });

program
  .command('find-start-blocks')
  .description('Find deployment blocks for all contracts in your config')
  .option('-c, --config <path>', 'Path to config file', './ponder.config.ts')
  .action(async (options) => {
    try {
      console.log('🚀 Finding deployment blocks for all contracts...\n');

      // Check if config file exists
      if (!fs.existsSync(options.config)) {
        console.error(`❌ Config file not found: ${options.config}`);
        process.exit(1);
      }

      const configPath = resolve(options.config);

      // Create a temporary script file to avoid module resolution issues
      const tempFile = join(dirname(configPath), '.zonder-temp-find-blocks.mjs');
      const findStartBlocksModulePath = join(__dirname, '../lib/findStartBlocks.js');

      const scriptContent = `
import { config } from 'dotenv';
config({ path: '.env.local' }); // Match Ponder's exact env loading

import { zonderConfig } from '${configPath}';
import { findAllDeploymentBlocks } from '${findStartBlocksModulePath}';

await findAllDeploymentBlocks(zonderConfig);

console.log("\\nResults saved to start-blocks.json");
`;

      fs.writeFileSync(tempFile, scriptContent);

      const command = `npx tsx ${tempFile}`;

      try {
        execSync(command, { stdio: 'inherit', env: process.env });
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    } catch (error) {
      console.error('❌ Error finding start blocks:', error);
      process.exit(1);
    }
  });

program.parse();
