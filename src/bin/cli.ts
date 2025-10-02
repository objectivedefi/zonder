#!/usr/bin/env node
import { Command } from 'commander';
import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'fs';
import fs from 'fs';
import { createJiti } from 'jiti';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { generateAndWriteClickHouseClient } from '../lib/envio/generateClickHouseClient.js';
import { generateAndWriteClickHouseSchema } from '../lib/envio/generateClickHouseSchema.js';
import { generateAndWriteEnvExample } from '../lib/envio/generateEnvExample.js';
// Direct imports for generators
import { generateAndWriteEnvioConfig } from '../lib/envio/generateEnvioConfig.js';
import { generateAndWriteEventHandlers } from '../lib/envio/generateEventHandlers.js';
import { generateAndWriteGraphQLSchema } from '../lib/envio/generateGraphQLSchema.js';
import { findAllDeploymentBlocks } from '../lib/scripts/findStartBlocks.js';
import { takeAbi } from '../lib/scripts/takeAbi.js';

// Get package.json for version sync
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command('generate')
  .description('Generate Envio indexer files')
  .option('-c, --config <path>', 'Path to config file', './zonder.config.ts')
  .option('--overwrite', 'Overwrite existing files without warning')
  .action(async (options) => {
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
        if (errorStr.includes('RPC_URL')) {
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

      console.log('🔨 Generating Envio files...');
      const configYamlPath = resolve('./config.yaml');
      const handlersPath = resolve('./src/EventHandlers.ts');
      const clickhouseClientPath = resolve('./src/clickhouse.ts');
      const envExamplePath = resolve('./.env.example');
      const clickhouseSchemaPath = resolve('./clickhouse-schema.sql');

      const srcDir = dirname(handlersPath);
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      // Generate core Envio files
      generateAndWriteEnvioConfig(zonderConfig, configYamlPath, 'envio-indexer', options.overwrite);
      generateAndWriteGraphQLSchema(zonderConfig, options.overwrite);
      generateAndWriteEventHandlers(zonderConfig, handlersPath, options.overwrite);
      generateAndWriteEnvExample(envExamplePath, options.overwrite);

      console.log('✅ Envio files generated!');

      // Generate ClickHouse files (if enabled)
      const clickhouseEnabled = zonderConfig.clickhouse?.enabled !== false;
      if (clickhouseEnabled) {
        console.log('\n🔨 Generating ClickHouse files...');

        // Load .env to get database name
        dotenvConfig({ path: '.env' });
        const databaseName =
          process.env.CLICKHOUSE_DATABASE || zonderConfig.clickhouse?.databaseName || 'default';

        generateAndWriteClickHouseSchema(
          zonderConfig,
          clickhouseSchemaPath,
          databaseName,
          options.overwrite,
        );
        generateAndWriteClickHouseClient(clickhouseClientPath, options.overwrite);

        console.log('✅ ClickHouse files generated!');
        console.log('');
        console.log('📝 Next steps for ClickHouse:');
        console.log('   1. Fill in ClickHouse credentials in .env');
        console.log('   2. Run: pnpm zonder migrate');
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
  .command('migrate')
  .description('Create ClickHouse tables from schema')
  .option('--schema <path>', 'Path to schema file', './clickhouse-schema.sql')
  .option('--force', 'Force migration even if tables already exist')
  .action(async (options) => {
    try {
      console.log('🔨 Creating ClickHouse tables...');

      // Load environment variables from .env files
      dotenvConfig({ path: '.env' });

      // Dynamic import for optional peer dependency
      let createClient: any;
      try {
        const clickhouse = await import('@clickhouse/client' as any);
        createClient = clickhouse.createClient;
      } catch (error) {
        console.error('❌ @clickhouse/client is not installed');
        console.log('💡 Install it with: pnpm add @clickhouse/client');
        process.exit(1);
      }

      const schemaPath = resolve(options.schema);

      // Load environment variables
      const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
      const CLICKHOUSE_USERNAME = process.env.CLICKHOUSE_USERNAME || 'default';
      const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD;
      const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'default';

      // Validate environment
      if (!CLICKHOUSE_URL) {
        console.error('❌ CLICKHOUSE_URL environment variable is required');
        console.log('💡 Set this in your .env file');
        process.exit(1);
      }

      if (!CLICKHOUSE_PASSWORD) {
        console.error('❌ CLICKHOUSE_PASSWORD environment variable is required');
        console.log('💡 Set this in your .env file');
        process.exit(1);
      }

      // Create client without specifying database (will create it first)
      const client = createClient({
        url: CLICKHOUSE_URL,
        username: CLICKHOUSE_USERNAME,
        password: CLICKHOUSE_PASSWORD,
      });

      try {
        await client.ping();
        console.log('✅ Connected to ClickHouse successfully');
      } catch (error) {
        console.error('❌ Failed to connect to ClickHouse:', error);
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('  - Check CLICKHOUSE_URL is correct (include port, e.g., https://host:8443)');
        console.log('  - Verify CLICKHOUSE_PASSWORD is correct');
        console.log('  - Ensure network connectivity to ClickHouse instance');
        process.exit(1);
      }

      // Read schema file
      let sql: string;
      try {
        sql = fs.readFileSync(schemaPath, 'utf-8');
      } catch (error) {
        console.error(`❌ Failed to read schema file: ${schemaPath}`);
        console.log('💡 Run "pnpm zonder generate" first to create the schema');
        process.exit(1);
      }

      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      // Separate database creation from table creation
      const databaseStatements = statements.filter((s) => s.match(/CREATE DATABASE/i));
      const tableStatements = statements.filter((s) => s.match(/CREATE TABLE/i));

      // Execute database creation first
      if (databaseStatements.length > 0) {
        console.log('\n📊 Creating database...\n');
        for (const statement of databaseStatements) {
          try {
            await client.command({ query: statement });
            console.log('✅ Database created');
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              console.error('❌ Failed to create database:', error.message);
              await client.close();
              process.exit(1);
            }
            console.log('✅ Database already exists');
          }
        }
      }

      // Extract table names from schema
      const schemaTableNames = new Set<string>();
      for (const statement of tableStatements) {
        const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (?:[\w]+\.)?([\w]+)/i);
        if (tableMatch) {
          schemaTableNames.add(tableMatch[1]);
        }
      }

      // Check for existing tables
      try {
        const result = await client.query({
          query: `SELECT name FROM system.tables WHERE database = '${CLICKHOUSE_DATABASE}' AND name != 'schema_migrations'`,
          format: 'JSONEachRow',
        });
        const existingTables = (await result.json()) as Array<{ name: string }>;
        const existingTableNames = new Set(existingTables.map((t: any) => t.name));

        if (existingTables.length > 0) {
          // Check if all schema tables exist
          const allTablesExist = Array.from(schemaTableNames).every((tableName) =>
            existingTableNames.has(tableName),
          );
          const noExtraTables = existingTables.every((table: any) =>
            schemaTableNames.has(table.name),
          );

          if (allTablesExist && noExtraTables) {
            // Perfect match - all schema tables exist, no extra tables
            console.log('✅ All tables already exist and match schema');
            console.log(`   Found ${existingTables.length} tables in database`);
            await client.close();
            process.exit(0);
          }

          if (!options.force) {
            // Schema mismatch - provide helpful guidance
            const missingTables = Array.from(schemaTableNames).filter(
              (name) => !existingTableNames.has(name),
            );
            const extraTables = existingTables.filter(
              (table: any) => !schemaTableNames.has(table.name),
            );

            if (missingTables.length > 0 || extraTables.length > 0) {
              console.error('❌ Schema mismatch detected:');
              if (missingTables.length > 0) {
                console.error(`\n   Missing tables (${missingTables.length}):`);
                missingTables.slice(0, 5).forEach((name) => {
                  console.error(`   - ${name}`);
                });
                if (missingTables.length > 5) {
                  console.error(`   ... and ${missingTables.length - 5} more`);
                }
              }
              if (extraTables.length > 0) {
                console.error(`\n   Extra tables not in schema (${extraTables.length}):`);
                extraTables.slice(0, 5).forEach((table: any) => {
                  console.error(`   - ${table.name}`);
                });
                if (extraTables.length > 5) {
                  console.error(`   ... and ${extraTables.length - 5} more`);
                }
              }
              console.log('');
              console.log('💡 Options:');
              console.log('   - Use --force to drop extra tables and create missing ones');
              console.log('   - Manually reconcile the schema differences');
              await client.close();
              process.exit(1);
            }
          } else {
            // --force: Drop tables that are NOT in the new schema
            const tablesToDrop = existingTables.filter(
              (table: any) => !schemaTableNames.has(table.name),
            );

            if (tablesToDrop.length > 0) {
              console.log(`🗑️  Dropping ${tablesToDrop.length} old tables...\n`);
              const dropResults = await Promise.all(
                tablesToDrop.map(async (table: any) => {
                  try {
                    await client.command({
                      query: `DROP TABLE IF EXISTS ${CLICKHOUSE_DATABASE}.${table.name}`,
                    });
                    return { success: true, name: table.name };
                  } catch (error: any) {
                    return { success: false, name: table.name, error: error.message };
                  }
                }),
              );

              const dropped = dropResults.filter((r) => r.success).length;
              const failed = dropResults.filter((r) => !r.success);

              console.log(`✅ Dropped ${dropped} tables`);
              if (failed.length > 0) {
                console.error(`❌ Failed to drop ${failed.length} tables`);
              }
              console.log('');
            }

            const tablesToKeep = existingTables.filter((table: any) =>
              schemaTableNames.has(table.name),
            );
            if (tablesToKeep.length > 0) {
              console.log(`✅ Keeping ${tablesToKeep.length} existing tables\n`);
            }
          }
        }
      } catch (error: any) {
        console.error('⚠️  Could not check existing tables:', error.message);
        console.log('   Proceeding with migration...\n');
      }

      console.log(
        `\n📊 Executing ${tableStatements.length} table creation statements in parallel...\n`,
      );

      // Execute all table statements in parallel for speed
      const results = await Promise.all(
        tableStatements.map(async (statement, i) => {
          try {
            await client.command({ query: statement });
            return { success: true, index: i };
          } catch (error: any) {
            return { success: false, index: i, error: error.message || error };
          }
        }),
      );

      await client.close();

      // Check results
      const failed = results.filter((r) => !r.success);

      if (failed.length > 0) {
        console.error(`❌ Migration failed! ${failed.length} statement(s) failed:\n`);
        failed.forEach((result) => {
          console.error(`   Statement ${result.index + 1}: ${result.error}`);
        });
        process.exit(1);
      }

      console.log('✅ Migration complete! All tables created successfully.\n');
      console.log('📝 Next steps:');
      console.log('   1. Run: pnpm envio codegen');
      console.log('   2. Run: pnpm dev');
    } catch (error) {
      console.error('❌ Error:', error);
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
