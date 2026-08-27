import { describe, expect, it } from 'vitest';
import {
	ARTIFACT_AUTHORING_CONTRACT,
	renderArtifactAuthoringGuide,
	renderLlmsIndex
} from './authoring-contract';

describe('artifact authoring documentation', () => {
	it('publishes absolute discovery links', () => {
		const index = renderLlmsIndex('https://talks.example.com');

		expect(index).toContain('https://talks.example.com/llms-full.txt');
		expect(index).toContain('https://talks.example.com/api/public/v1/openapi.json');
		expect(index).toContain('https://talks.example.com/api/public/v1/authoring-contract');
	});

	it('covers the complete artifact workflow and runtime markers', () => {
		const guide = renderArtifactAuthoringGuide('https://talks.example.com');

		for (const expected of [
			'renderer_type',
			'data-cs-action',
			'data-cs-form',
			'data-cs-form-status',
			'data-cs-widget',
			'campaignPageId',
			'previewUrl',
			'publish',
			'rollback',
			'unpublish',
			'--cs-font-sans',
			'--cs-font-display'
		]) {
			expect(guide).toContain(expected);
		}
	});

	it('derives bundle and form rules from the canonical contract', () => {
		expect(ARTIFACT_AUTHORING_CONTRACT.contractVersion).toBe(3);
		expect(ARTIFACT_AUTHORING_CONTRACT.bundle.allowedMediaTypes).toContain('text/html');
		expect(
			ARTIFACT_AUTHORING_CONTRACT.runtime.cta.optionalAttributes['data-cs-cta-type'].values
		).toContain('booking');
		expect(ARTIFACT_AUTHORING_CONTRACT.runtime.leadForm.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'email', required: true }),
				expect.objectContaining({ name: 'scope', required: true })
			])
		);
		expect(ARTIFACT_AUTHORING_CONTRACT.runtime.youtubeVideo.requiredAttributes).toEqual(
			expect.objectContaining({ 'data-cs-youtube-id': expect.stringContaining('11') })
		);
	});
});
