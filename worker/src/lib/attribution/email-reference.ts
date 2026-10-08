import { parseEmailVisitReference } from '../../../../shared/email-visit-reference';
import { selectOne } from '../db';
import type { WorkerEnv } from '../env';

export async function resolveEmailVisitReference(
	env: WorkerEnv,
	input: {
		bodyText: string;
		campaignId: number | null;
		campaignPageId: number | null;
		observedAt: Date;
	}
): Promise<number | null> {
	const token = parseEmailVisitReference(input.bodyText);
	if (!token || !input.campaignId || !input.campaignPageId) return null;
	const reference = await selectOne<{ campaign_visit_id: number }>(
		env,
		'email_visit_references',
		new URLSearchParams({
			select: 'campaign_visit_id',
			token: `eq.${token}`,
			created_at: `lte.${input.observedAt.toISOString()}`,
			limit: '1'
		})
	);
	if (!reference) return null;
	const visit = await selectOne<{ id: number }>(
		env,
		'campaign_visits',
		new URLSearchParams({
			select: 'id',
			id: `eq.${reference.campaign_visit_id}`,
			campaign_id: `eq.${input.campaignId}`,
			campaign_page_id: `eq.${input.campaignPageId}`,
			visited_at: `lte.${input.observedAt.toISOString()}`,
			limit: '1'
		})
	);
	return visit?.id ?? null;
}
