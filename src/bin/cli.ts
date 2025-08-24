#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import fs from 'fs';
import { createJiti } from 'jiti';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { generateAndWriteEnvExample } from '../lib/envio/generateEnvExample.js';
// Direct imports for generators
import { generateAndWriteEnvioConfig } from '../lib/envio/generateEnvioConfig.js';
import { generateAndWriteEventHandlers } from '../lib/envio/generateEventHandlers.js';
import { generateAndWriteGraphQLSchema } from '../lib/envio/generateGraphQLSchema.js';
import {
  generateAndWriteIndex,
  generateAndWritePonderConfig,
  generateAndWritePonderEnvExample,
  generateAndWriteSchema,
} from '../lib/ponder/index.js';
import { findAllDeploymentBlocks } from '../lib/scripts/findStartBlocks.js';
import { takeAbi } from '../lib/scripts/takeAbi.js';

// Get package.json for version sync
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command('generate <runtime>')
  .description('Generate indexer files for specified runtime (ponder or envio)')
  .option('-c, --config <path>', 'Path to config file', './zonder.config.ts')
  .option('--overwrite', 'Overwrite existing files without warning')
  .action(async (runtime, options) => {
    try {
      const configPath = resolve(options.config);

      // JITI config loading - battle-tested by Nuxt, ESLint, etc.
      let zonderConfig;
      try {
        const jiti = createJiti(import.meta.url);
        const configModule = (await jiti.import(configPath)) as any;
        zonderConfig = configModule.zonderConfig;

        console.log('✅ Config loaded successfully');
        console.log(`📋 Found ${Object.keys(zonderConfig?.contracts || {}).length} contracts`);
        console.log(`📋 Found ${Object.keys(zonderConfig?.chains || {}).length} chains`);
      } catch (error) {
        const errorStr = String(error);
        console.log('❌ Config loading failed');
        console.error('🔍 Full error:', error);

        // Provide helpful error messages for common issues
        if (errorStr.includes('PONDER_RPC_URL')) {
          console.log(
            '💡 Missing RPC URL environment variables. This is expected for Envio generation.',
          );
          console.log('💡 Set RPC URLs in .env.local if you need dynamic address resolution.');
        } else if (errorStr.includes('Cannot find module')) {
          console.log('💡 Missing dependencies. Run "pnpm install" to install required packages.');
        } else {
          console.log('💡 Check your config file syntax and imports.');
        }

        console.log('⚠️  Continuing with empty config - generated files will be minimal.');
        zonderConfig = { contracts: {}, chains: {} };
      }

      if (runtime === 'ponder') {
        console.log('🔨 Generating Ponder files...');
        const configPath = resolve('./ponder.config.ts');
        const schemaPath = resolve('./ponder.schema.ts');
        const indexPath = resolve('./src/index.ts');
        const envExamplePath = resolve('./.env.example');

        const srcDir = dirname(indexPath);
        if (!fs.existsSync(srcDir)) {
          fs.mkdirSync(srcDir, { recursive: true });
        }

        generateAndWritePonderConfig(configPath, options.overwrite);
        generateAndWriteSchema(zonderConfig, schemaPath, options.overwrite);
        generateAndWriteIndex(indexPath, options.overwrite);
        generateAndWritePonderEnvExample(zonderConfig, envExamplePath, options.overwrite);

        console.log('✅ Ponder files generated!');
      } else if (runtime === 'envio') {
        console.log('🔨 Generating Envio files...');
        const configYamlPath = resolve('./config.yaml');
        const handlersPath = resolve('./src/EventHandlers.ts');
        const envExamplePath = resolve('./.env.example');

        const srcDir = dirname(handlersPath);
        if (!fs.existsSync(srcDir)) {
          fs.mkdirSync(srcDir, { recursive: true });
        }

        generateAndWriteEnvioConfig(
          zonderConfig,
          configYamlPath,
          'envio-indexer',
          options.overwrite,
        );
        generateAndWriteGraphQLSchema(zonderConfig, options.overwrite);
        generateAndWriteEventHandlers(zonderConfig, handlersPath, options.overwrite);
        generateAndWriteEnvExample(envExamplePath, options.overwrite);

        console.log('✅ Envio files generated!');
      } else {
        console.error(`❌ Invalid runtime: ${runtime}. Use 'ponder' or 'envio'.`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program
  .command('take-abi <outDir> [contracts...]')
  .description('Extract ABIs from Foundry build artifacts')
  .option('--overwrite', 'Overwrite existing files without warning')
  .action(async (outDir, contracts, options) => {
    try {
      console.log('🔨 Extracting ABIs from Foundry build artifacts...');

      if (!contracts || contracts.length === 0) {
        console.error('❌ No contracts specified. Please provide contract names.');
        console.log('💡 Usage: pnpm zonder take-abi path/to/foundry/out ContractA ContractB');
        process.exit(1);
      }

      await takeAbi(outDir, contracts, options.overwrite);
      console.log('✅ ABIs extracted successfully!');
    } catch (error) {
      console.error('❌ Error extracting ABIs:', error);
      process.exit(1);
    }
  });

program
  .command('find-start-blocks')
  .description('Auto-discover deployment blocks for all contracts')
  .option('-c, --config <path>', 'Path to config file', './zonder.config.ts')
  .option('--overwrite', 'Overwrite existing files without warning')
  .action(async (options) => {
    try {
      console.log('🔨 Auto-discovering deployment blocks...');

      const configPath = resolve(options.config);

      // Load config
      let zonderConfig;
      try {
        const jiti = createJiti(import.meta.url);
        const configModule = (await jiti.import(configPath)) as any;
        zonderConfig = configModule.zonderConfig;

        console.log('✅ Config loaded successfully');
      } catch (error) {
        console.error('❌ Config loading failed:', error);
        console.log('💡 Make sure your config file exists and has a valid zonderConfig export.');
        process.exit(1);
      }

      const results = await findAllDeploymentBlocks(zonderConfig, options.overwrite);

      console.log('\n🎉 Deployment blocks discovered!');
      console.log('📋 Results saved to start-blocks.json');
      console.log('\n📝 Copy-paste this startBlocks config:');
      console.log('startBlocks: {');

      for (const [chainName, chainBlocks] of Object.entries(results)) {
        if (Object.keys(chainBlocks).length > 0) {
          console.log(`  ${chainName}: {`);
          for (const [contractName, blockNumber] of Object.entries(chainBlocks)) {
            console.log(`    ${contractName}: ${blockNumber},`);
          }
          console.log('  },');
        }
      }

      console.log('}');
    } catch (error) {
      console.error('❌ Error finding start blocks:', error);
      process.exit(1);
    }
  });

program.parse();
