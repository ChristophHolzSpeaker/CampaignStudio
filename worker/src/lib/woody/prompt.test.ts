import { describe, expect, it } from 'vitest';
import { buildWoodyPrompt } from './prompt';

describe('buildWoodyPrompt', () => {
	it('requires the approved seven-field lead invitation format in German', () => {
		const prompt = buildWoodyPrompt({
			sender_name: 'Jaun-Paul Stevenson',
			sender_email: 'jp@example.com',
			inbound_subject: 'Einladung zur XYZ-Konferenz',
			inbound_body: 'Die Konferenz findet am 30. Januar 2025 in Berlin statt.',
			response_language: 'German',
			booking_link: 'https://speaker.christophholz.com/book/l/token',
			response_type: 'initial_speaking_inquiry_ack'
		});

		expect(prompt.prompt_version).toBe('woody_v3');
		const labels = [
			'Ort',
			'Datum und Uhrzeit',
			'Veranstaltungsname',
			'Publikum',
			'Thema',
			'Anfragender',
			'Organisation'
		];
		for (let index = 1; index < labels.length; index += 1) {
			expect(prompt.system_prompt.indexOf(labels[index - 1])).toBeLessThan(
				prompt.system_prompt.indexOf(labels[index])
			);
		}
		expect(prompt.system_prompt).toContain('To be determined');
		expect(prompt.system_prompt).toContain('only in the response_language');
		expect(prompt.system_prompt).toContain('Videoanruf planen');
		expect(prompt.system_prompt).toContain('full booking URL');
		expect(prompt.system_prompt).not.toContain('Talking Length');
		expect(prompt.system_prompt).not.toContain('AI-assisted coordination experiment');
	});
});
