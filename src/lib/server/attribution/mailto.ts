const SPEAKER_EMAIL_LOCAL_PART = 'speaker';
const SPEAKER_EMAIL_DOMAIN = 'christophholz.com';

export const DEFAULT_SPEAKER_EMAIL_SUBJECT = 'Request a talk';

export function buildSpeakerMailtoHref(input: {
	campaignId: number | null;
	campaignPageId: number | null;
	subject?: string;
}): string {
	const hasCampaignContext =
		typeof input.campaignId === 'number' &&
		input.campaignId > 0 &&
		typeof input.campaignPageId === 'number' &&
		input.campaignPageId > 0;

	const aliasToken = hasCampaignContext ? `+cmp${input.campaignId}_cp${input.campaignPageId}` : '';
	const emailAddress = `${SPEAKER_EMAIL_LOCAL_PART}${aliasToken}@${SPEAKER_EMAIL_DOMAIN}`;
	const searchParams = new URLSearchParams();
	const subject = input.subject?.trim();

	if (subject) {
		searchParams.set('subject', subject);
	}

	const queryString = searchParams.toString();

	return `mailto:${emailAddress}${queryString ? `?${queryString}` : ''}`;
}
