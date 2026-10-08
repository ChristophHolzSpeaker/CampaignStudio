import { db } from '$lib/server/db';
import { email_visit_references } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolveCampaignVisitId } from './campaign-visits';
import { emailReferenceLine } from '../../../../shared/email-visit-reference';

export async function issueEmailVisitReference(input: {
	campaignId: number;
	campaignPageId: number;
	visitorIdentifier: string;
	requestedVisitId?: number;
}): Promise<string | null> {
	const visitId = await resolveCampaignVisitId(input);
	if (!visitId) return null;
	const [created] = await db
		.insert(email_visit_references)
		.values({ campaign_visit_id: visitId })
		.onConflictDoNothing({ target: email_visit_references.campaign_visit_id })
		.returning({ token: email_visit_references.token });
	const existing =
		created ??
		(
			await db
				.select({ token: email_visit_references.token })
				.from(email_visit_references)
				.where(eq(email_visit_references.campaign_visit_id, visitId))
				.limit(1)
		)[0];
	return existing ? emailReferenceLine(existing.token) : null;
}
