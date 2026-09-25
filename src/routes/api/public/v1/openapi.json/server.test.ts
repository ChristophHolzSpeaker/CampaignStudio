import { describe, expect, it } from 'vitest';
import { _openApiDocument } from './+server';

describe('public OpenAPI document', () => {
	it('keeps documentation public and mutations authenticated', () => {
		expect(_openApiDocument.paths['/api/public/v1/authoring-contract'].get.security).toEqual([]);
		expect(
			_openApiDocument.paths['/api/public/v1/campaigns/{campaignId}/artifact-versions'].post
				.security
		).toEqual([{ bearerAuth: [] }]);
	});

	it('documents artifact-only campaign creation and every lifecycle response', () => {
		expect(_openApiDocument.components.schemas.ArtifactCampaignCreateRequest).toBeDefined();
		expect(_openApiDocument.components.schemas.ArtifactUploadSessionResponse).toBeDefined();
		expect(_openApiDocument.components.schemas.ArtifactFileUploadResponse).toBeDefined();
		expect(_openApiDocument.components.schemas.ArtifactFinalizeResponse).toBeDefined();
		expect(_openApiDocument.components.schemas.ArtifactPublishResponse).toBeDefined();
		expect(_openApiDocument.components.schemas.ArtifactUnpublishResponse).toBeDefined();
	});
});

it('documents the visit button and consent integration without requiring a journey', () => {
	const paths = _openApiDocument.paths;
	expect(paths['/api/public/v1/campaign-visits/{id}/outcomes'].post.operationId).toBe(
		'recordVisitOutcome'
	);
	expect(paths['/api/public/v1/campaign-visits/{id}/tracking'].get.operationId).toBe(
		'getVisitTracking'
	);
	expect(paths['/api/runtime/v1/consent'].post.security).toEqual([]);
});
