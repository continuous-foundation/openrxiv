#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const sourceFile = path.join(process.cwd(), '..', 'openrxiv', 'README.md');
const targetFile = path.join(process.cwd(), 'README.md');

try {
  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Source README not found: ${sourceFile}`);
    process.exit(1);
  }

  let content = fs.readFileSync(sourceFile, 'utf8');

  // Replace based on package name
  const packageName = process.env.npm_package_name;
  if (packageName === 'biorxiv') {
    content = content.replace(/openrxiv/g, 'biorxiv');
    content = content.replace(/openRxiv/g, 'bioRxiv');
  } else if (packageName === 'medrxiv') {
    content = content.replace(/openrxiv/g, 'medrxiv');
    content = content.replace(/openRxiv/g, 'medRxiv');
  }

  fs.writeFileSync(targetFile, content);
} catch (error) {
  console.error('❌ Error copying README:', error.message);
  process.exit(1);
}
