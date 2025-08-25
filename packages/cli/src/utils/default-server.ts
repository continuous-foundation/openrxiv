import path from 'node:path';

export function getCliName(): 'openrxiv' | 'biorxiv' | 'medrxiv' {
  // process.argv[1] contains the script path, which includes the alias
  const scriptPath = process.argv[1];
  const commandName = path.basename(scriptPath);

  if (commandName.toLowerCase().includes('biorxiv')) {
    return 'biorxiv';
  }
  if (commandName.toLowerCase().includes('medrxiv')) {
    return 'medrxiv';
  }
  return 'openrxiv';
}

export function getDefaultServer(): 'biorxiv' | 'medrxiv' {
  const cliName = getCliName();

  if (cliName.toLowerCase().includes('medrxiv')) {
    return 'medrxiv';
  }
  return 'biorxiv';
}
