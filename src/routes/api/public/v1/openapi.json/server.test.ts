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
