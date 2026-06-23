import { z } from 'zod';
import { landingPageDocumentSchema } from '$lib/page-builder/page';
import { pageSectionTypes, sectionSpecs } from '$lib/page-builder/sections';
import { publicApiJson, requirePublicApiReadOrWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const guard = await requirePublicApiReadOrWriteRequest(request);
	if (!guard.ok) return guard.response;

	return publicApiJson(
		{
			ok: true,
			data: {
				contentJsonSchema: z.toJSONSchema(landingPageDocumentSchema),
				sectionTypes: pageSectionTypes,
				sections: pageSectionTypes.map((type) => {
					const spec = sectionSpecs[type];

					return {
						type: spec.type,
						label: spec.label,
						description: spec.description,
						whenToUse: spec.whenToUse,
						whenNotToUse: spec.whenNotToUse,
						contentGuidance: spec.contentGuidance,
						propsSchema: z.toJSONSchema(spec.propsSchema)
					};
				})
			}
		},
		guard.context
	);
};
