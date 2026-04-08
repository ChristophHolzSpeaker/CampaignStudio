import { landingPageDocumentSchema } from './schema';

export { landingPageDocumentSchema, type LandingPageDocumentSchemaType } from './schema';
export { christophSampleLandingPage } from './sample';
export { type LandingPageDocument } from './types';

export function parseLandingPageDocument(input: unknown) {
	return landingPageDocumentSchema.parse(input);
}

export function safeParseLandingPageDocument(input: unknown) {
	return landingPageDocumentSchema.safeParse(input);
}
