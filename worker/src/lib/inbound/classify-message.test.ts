import { describe, expect, it } from 'vitest';
import { classifyInboundMessage } from './classify-message';

describe('classify inbound message', () => {
	it('classifies strong speaking inquiry signals', () => {
		const result = classifyInboundMessage({
			subject: 'Keynote invite for our conference',
			body_text: 'Would you be available to speak at our event?'
		});

		expect(result.classification).toBe('speaking_inquiry');
		expect(result.reason).toBe('strong_positive_signals');
	});

	it('classifies single positive signal as speaking inquiry', () => {
		const result = classifyInboundMessage({
			subject: 'Speaker request',
			body_text: 'Can we discuss details?'
		});

		expect(result.classification).toBe('speaking_inquiry');
		expect(result.reason).toBe('single_positive_signal');
	});

	it('classifies negative-only signals as not speaking inquiry', () => {
		const result = classifyInboundMessage({
			subject: 'Out of office autoreply',
			body_text: 'I am unavailable right now.'
		});

		expect(result.classification).toBe('not_speaking_inquiry');
		expect(result.reason).toBe('negative_signal_match');
	});

	it('returns uncertain for low-signal content', () => {
		const result = classifyInboundMessage({
			subject: 'Hello',
			body_text: 'Thanks'
		});

		expect(result.classification).toBe('uncertain');
		expect(result.reason).toBe('insufficient_signal');
	});
});
