#!/usr/bin/env node
/*
update-ui.ts
TypeScript script to run `npx shadcn-svelte@latest add <component>` for components
detected under `src/lib/components/ui`.

Usage:
  node --experimental-strip-types scripts/update-ui.ts [--components componentA,componentB] [--dry-run]

By default it reads subdirectories of `src/lib/components/ui` and runs the
`npx shadcn-svelte@latest add` command for those component names.
*/

import { execSync } from 'child_process';
import * as fsp from 'fs/promises';
import path from 'path';

type Args = {
	components?: string[];
	dryRun?: boolean;
	help?: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { components: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') args.dryRun = true;
		else if (a === '-h' || a === '--help') args.help = true;
		else if (a === '--components') {
			const val = argv[++i] || '';
			args.components = val
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
		} else {
			// treat as positional component name
			args.components!.push(a);
		}
	}
	return args;
}

async function exists(p: string) {
	try {
		await fsp.access(p);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const argv = parseArgs(process.argv.slice(2));
	if (argv.help) {
		console.log('Usage: node scripts/update-ui.js [--components a,b] [--dry-run] [component...]');
		process.exit(0);
	}

	const projectRoot = process.cwd();
	const uiDir = path.resolve(projectRoot, 'src/lib/components/ui');

	if (!(await exists(uiDir))) {
		console.error('UI directory not found:', uiDir);
		process.exit(1);
	}

	const entries = await fsp.readdir(uiDir, { withFileTypes: true });
	const detected = entries.filter((e) => e.isDirectory()).map((e) => e.name);

	const components = argv.components && argv.components.length ? argv.components : detected;

	if (!components || components.length === 0) {
		console.log('No components found to add. Inspect', uiDir);
		process.exit(0);
	}

	const cmd = `npx shadcn-svelte@latest add ${components.join(' ')}`;
	console.log('Will run:', cmd);

	if (argv.dryRun) {
		console.log('[dry-run] not executing command');
		return;
	}

	try {
		execSync(cmd, { stdio: 'inherit' });
	} catch (err: any) {
		console.error('Command failed:', err && err.message ? err.message : err);
		process.exit(1);
	}

	console.log('shadcn-svelte add finished successfully.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
