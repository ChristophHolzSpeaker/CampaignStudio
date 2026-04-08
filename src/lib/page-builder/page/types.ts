import type { PageSection } from '$lib/page-builder/sections';

export interface LandingPageDocument {
	version: 1;
	title: string;
	slug?: string;
	sections: PageSection[];
}
