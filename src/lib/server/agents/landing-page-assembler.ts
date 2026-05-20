import { parseLandingPageDocument, type LandingPageDocument } from '$lib/page-builder/page';

export function assembleLandingPageDocument(page: LandingPageDocument): LandingPageDocument {
	return parseLandingPageDocument(page);
}
