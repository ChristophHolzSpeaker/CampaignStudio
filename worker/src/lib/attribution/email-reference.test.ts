import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';
import {
	emailReferenceLine,
	parseEmailVisitReference
} from '../../../../shared/email-visit-reference';

vi.mock('../db', () => ({ selectOne: vi.fn() }));
import { selectOne } from '../db';
import { resolveEmailVisitReference } from './email-reference';

const token = '00112233-4455-4677-8899-aabbccddeeff';
const input = {
	bodyText: `Anfrage\n\n${emailReferenceLine(token)}`,
	campaignId: 39,
	campaignPageId: 287,
	observedAt: new Date('2026-10-08T10:00:00Z')
};
beforeEach(() => vi.mocked(selectOne).mockReset());
describe('email visit references', () => {
	it('recognizes repeated identical references but rejects conflicting references', () => {
		expect(parseEmailVisitReference(input.bodyText + '\n' + emailReferenceLine(token))).toBe(token);
		expect(
			parseEmailVisitReference(
				input.bodyText + '\n' + emailReferenceLine('ffffffff-ffff-4fff-8fff-ffffffffffff')
			)
		).toBeNull();
	});
	it('resolves the recorded visit only in the recipient campaign and page', async () => {
		vi.mocked(selectOne)
			.mockResolvedValueOnce({ campaign_visit_id: 42 })
			.mockResolvedValueOnce({ id: 42 });
		expect(await resolveEmailVisitReference(makeTestEnv(), input)).toBe(42);
		const query = vi.mocked(selectOne).mock.calls[1][2];
		expect(Object.fromEntries(query)).toMatchObject({
			id: 'eq.42',
			campaign_id: 'eq.39',
			campaign_page_id: 'eq.287',
			visited_at: 'lte.2026-10-08T10:00:00.000Z'
		});
	});
	it('does not link unknown references or mismatched visits', async () => {
		vi.mocked(selectOne).mockResolvedValueOnce(null);
		expect(await resolveEmailVisitReference(makeTestEnv(), input)).toBeNull();
		vi.mocked(selectOne)
			.mockResolvedValueOnce({ campaign_visit_id: 42 })
			.mockResolvedValueOnce(null);
		expect(await resolveEmailVisitReference(makeTestEnv(), input)).toBeNull();
	});
	it('keeps copied-address inquiries and conflicting references campaign-only', async () => {
		expect(
			await resolveEmailVisitReference(makeTestEnv(), {
				...input,
				bodyText: 'Anfrage ohne Referenz'
			})
		).toBeNull();
		expect(
			await resolveEmailVisitReference(makeTestEnv(), { ...input, campaignPageId: null })
		).toBeNull();
		expect(selectOne).not.toHaveBeenCalled();
	});
});
