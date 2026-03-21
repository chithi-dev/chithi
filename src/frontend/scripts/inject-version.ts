import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'build-info.json');

/**
 * Run a git command and return its output, or null on failure
 */
function git(cmd: string): string | null {
	try {
		return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return null;
	}
}

// Get current commit hash
const commit = git('git rev-parse --short HEAD') ?? 'unknown';

// Determine Version Logic
const ghRefName = process.env.GITHUB_REF_NAME;
const ghRefType = process.env.GITHUB_REF_TYPE;

let version: string;

if (ghRefType === 'tag') {
	// Case: This is a formal GitHub Release/Tag
	version = ghRefName ?? 'unknown';
} else {
	// Fallback: Try to find the latest tag in history (requires fetch-depth: 0)
	const lastTag = git('git describe --tags --abbrev=0');
	if (lastTag) {
		version = `${lastTag}-${commit}`;
	} else {
		// No tags found in history at all
		version = `v0.0.0-${commit}`;
	}
}

// Write Output
const buildData = {
	version,
	commit,
	is_release: ghRefType === 'tag'
};

writeFileSync(outPath, JSON.stringify(buildData, null, 2));

console.log(`Build info JSON created at: ${outPath}`);
console.log(`Injected version: ${version}, commit: ${commit}`);
