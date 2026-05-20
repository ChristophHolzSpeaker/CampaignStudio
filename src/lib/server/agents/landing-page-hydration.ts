import { landingPageDocumentSchema, type LandingPageDocument } from '$lib/page-builder/page';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import type { ZodIssue } from 'zod';

type HydrationCallbacks = {
	normalizeRootResponse: (response: unknown) => unknown;
	hydrateLandingPageWithAssets: (normalizedResponse: unknown) => unknown;
	removeHybridSections: (response: unknown) => { removed: boolean; result: unknown };
};

export function validateWithHydrationPipeline(
	response: unknown,
	callbacks: HydrationCallbacks,
	traceContext: LlmTraceContext = {}
):
	| { success: true; data: LandingPageDocument }
	| { success: false; issues: ZodIssue[]; hydratedResponse: unknown } {
	const normalizedResponse = callbacks.normalizeRootResponse(response);
	const hydratedResponse = callbacks.hydrateLandingPageWithAssets(normalizedResponse);
	traceLlm(
		'hydration_applied',
		{ ...traceContext, stage: 'landing_page_writer' },
		{
			normalizedResponse,
			hydratedResponse
		}
	);

	const parsed = landingPageDocumentSchema.safeParse(hydratedResponse);
	if (parsed.success) {
		return { success: true, data: parsed.data };
	}

	const withoutHybrid = callbacks.removeHybridSections(hydratedResponse);
	if (withoutHybrid.removed) {
		const parsedWithoutHybrid = landingPageDocumentSchema.safeParse(withoutHybrid.result);
		if (parsedWithoutHybrid.success) {
			return { success: true, data: parsedWithoutHybrid.data };
		}
	}

	return {
		success: false,
		issues: parsed.error.issues,
		hydratedResponse
	};
}
