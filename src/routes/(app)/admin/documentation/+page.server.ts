import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const documentationPath = path.resolve(
	process.cwd(),
	'static/docs/campaign-studio-user-journey.md'
);

export const load: PageServerLoad = async () => {
	try {
		const markdown = await readFile(documentationPath, 'utf-8');

		return {
			markdown
		};
	} catch (readError) {
		console.error('Unable to load campaign documentation markdown.', readError);
		throw error(500, 'Could not load documentation content.');
	}
};
