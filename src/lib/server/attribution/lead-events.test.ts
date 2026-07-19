import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		insert: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { logLeadEvent } from './lead-events';

const mockedDb = vi.mocked(db);

describe('lead event experiment attribution', () => {
	beforeEach(() => {
		mockedDb.insert.mockReset();
	});

	it('persists the assigned experiment and variant IDs on a conversion', async () => {
		const values = vi.fn().mockResolvedValue(undefined);
		mockedDb.insert.mockReturnValueOnce({ values } as never);

		await logLeadEvent({
			eventType: 'form_submitted',
			eventSource: 'sveltekit.frictionless_funnel_inline_lead_booking_sequence',
			experiment: {
				experimentId: '11111111-1111-4111-8111-111111111111',
				variantId: '22222222-2222-4222-8222-222222222222'
			}
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				experiment_id: '11111111-1111-4111-8111-111111111111',
				variant_id: '22222222-2222-4222-8222-222222222222'
			})
		);
	});
});
