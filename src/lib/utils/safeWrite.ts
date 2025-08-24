import { existsSync, writeFileSync } from 'fs';

export interface SafeWriteOptions {
  overwrite?: boolean;
}

export function safeWriteFileSync(
  path: string,
  content: string,
  options: SafeWriteOptions = {},
): void {
  const { overwrite = false } = options;

  if (!overwrite && existsSync(path)) {
    console.warn(`⚠️  File already exists: ${path}`);
    console.warn('   Use --overwrite flag to overwrite existing files');
    return;
  }

  writeFileSync(path, content);
  console.log(`✅ ${overwrite && existsSync(path) ? 'Overwrote' : 'Created'}: ${path}`);
}
