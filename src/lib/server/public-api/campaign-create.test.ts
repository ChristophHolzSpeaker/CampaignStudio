import { describe, expect, it } from 'vitest';
import { christophSampleLandingPage } from '$lib/page-builder/page/sample';
import { publicCampaignCreateRequestSchema } from './campaign-create';

const campaign = {
	name: 'Future-ready leadership',
	audience: 'Technology leaders',
	format: 'Keynote campaign',
	topic: 'Leadership in the age of AI',
	language: 'English',
	geography: 'Global'
};

describe('publicCampaignCreateRequestSchema', () => {
	it('accepts an artifact-only campaign without section content', () => {
		const result = publicCampaignCreateRequestSchema.parse({
			renderer_type: 'artifact',
			campaign
		});

		expect(result).toEqual({ renderer_type: 'artifact', campaign });
	});

	it('preserves the existing sections request shape', () => {
		expect(
			publicCampaignCreateRequestSchema.safeParse({
				campaign,
				content_json: christophSampleLandingPage
			}).success
		).toBe(true);
	});

	it('rejects section content on an artifact-only request', () => {
		expect(
			publicCampaignCreateRequestSchema.safeParse({
				renderer_type: 'artifact',
				campaign,
				content_json: {}
			}).success
		).toBe(false);
	});
});
