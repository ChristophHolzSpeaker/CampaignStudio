import { describe, expect, it } from 'vitest';
import { parsePlusAddressAttribution, parsePlusAddressFromRecipients } from './plus-address';

describe('plus-address parsing', () => {
	it('parses valid cmp/cp token', () => {
		expect(parsePlusAddressAttribution('speaker+cmp12_cp3@christophholz.com')).toMatchObject({
			status: 'parsed',
			campaign_id: 12,
			campaign_page_id: 3
		});
	});

	it('returns missing_plus_address when plus token absent', () => {
		expect(parsePlusAddressAttribution('speaker@christophholz.com').status).toBe(
			'missing_plus_address'
		);
	});

	it('returns malformed_plus_address when token is invalid', () => {
		expect(parsePlusAddressAttribution('speaker+badtoken@christophholz.com').status).toBe(
			'malformed_plus_address'
		);
	});

	it('returns parsed when any recipient has valid plus token', () => {
		const parsed = parsePlusAddressFromRecipients([
			'hello@domain.com',
			'speaker+cmp7_cp8@christophholz.com'
		]);

		expect(parsed).toMatchObject({
			status: 'parsed',
			campaign_id: 7,
			campaign_page_id: 8
		});
	});

	it('returns malformed precedence when recipients include malformed token', () => {
		const parsed = parsePlusAddressFromRecipients([
			'hello@domain.com',
			'speaker+bad_token@christophholz.com'
		]);

		expect(parsed.status).toBe('malformed_plus_address');
	});
});
