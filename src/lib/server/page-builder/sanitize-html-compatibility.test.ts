import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('sanitize-html server compatibility', () => {
	it('loads without relying on the synchronous require(ESM) bridge', () => {
		expect(() =>
			execFileSync(
				process.execPath,
				['--no-experimental-require-module', '-e', "require('sanitize-html')"],
				{
					cwd: process.cwd(),
					stdio: 'pipe'
				}
			)
		).not.toThrow();
	});
});
