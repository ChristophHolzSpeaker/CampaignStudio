import type { PageServerLoad } from './$types';
import { christophSampleLandingPage, parseLandingPageDocument } from '$lib/page-builder/page';

export const load: PageServerLoad = async () => {
	const page = parseLandingPageDocument(christophSampleLandingPage);

	return {
		page
	};
};
