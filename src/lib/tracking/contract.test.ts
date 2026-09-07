import { describe, it, expect } from 'vitest';
import { findMapping, trackingConfigSchema, outcomeSchema, measurementSchema } from './contract';
describe('tracking contract', () => {
	it('accepts dynamic names and preserves case-sensitive YouTube action IDs', () => {
		expect(
			measurementSchema.parse({
				id: crypto.randomUUID(),
				name: 'video_play',
				action: 'video-mpbtCg2NSUs'
			}).action
		).toBe('video-mpbtCg2NSUs');
	});
	it('rejects arbitrary field data and invalid measurement identifiers', () => {
		expect(
			measurementSchema.safeParse({
				id: crypto.randomUUID(),
				name: 'form_input',
				email: 'person@example.com'
			}).success
		).toBe(false);
		expect(
			measurementSchema.safeParse({
				id: crypto.randomUUID(),
				name: 'form_input',
				action: 'person@example.com'
			}).success
		).toBe(false);
	});
	it('prefers specific mapping and leaves unknown events unmapped', () => {
		const base = {
			event: 'button_click',
			channel: 'browser' as const,
			conversionId: 'AW-123',
			conversionLabel: 'fallback'
		};
		const config = trackingConfigSchema.parse({
			mappings: [base, { ...base, action: 'booklet', conversionLabel: 'specific' }]
		});
		expect(findMapping(config, 'browser', 'button_click', 'booklet')?.conversionLabel).toBe(
			'specific'
		);
		expect(findMapping(config, 'browser', 'new_event')).toBeUndefined();
		expect(trackingConfigSchema.safeParse({ mappings: [base, base] }).success).toBe(false);
	});
	it('requires actual offline destinations and value/currency pairs', () => {
		expect(
			trackingConfigSchema.safeParse({
				mappings: [{ event: 'sale', channel: 'offline', conversionLabel: 'wrong' }]
			}).success
		).toBe(false);
		expect(
			outcomeSchema.safeParse({
				externalEventId: 'order:1',
				name: 'sale',
				occurredAt: '2026-01-01T00:00:00Z',
				value: 1,
				adUserDataConsent: 'GRANTED'
			}).success
		).toBe(false);
	});
});
