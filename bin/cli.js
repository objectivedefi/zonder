#!/usr/bin/env node
// Force tsx to run from user's directory to avoid package resolution issues
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '../dist/bin/cli.js');

// Run tsx with explicit working directory
try {
  execSync(`npx tsx "${cliPath}" ${process.argv.slice(2).join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env },
  });
} catch (error) {
  process.exit(error.status || 1);
}
