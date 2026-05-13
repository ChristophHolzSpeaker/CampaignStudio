const SPEAKER_EMAIL_LOCAL_PART = 'speaker';
const SPEAKER_EMAIL_DOMAIN = 'christophholz.com';

export const DEFAULT_SPEAKER_EMAIL_SUBJECT = 'Anfrage für einen Vortrag';

export const DEFAULT_SPEAKER_EMAIL_BODY = `Lieber Christoph Holz!

Wir planen einen Event:
Datum und Uhrzeit:
Veranstaltungsort:

Bitte um Kontaktaufnahme.`;

export function buildSpeakerMailtoHref(input: {
	campaignId: number | null;
	campaignPageId: number | null;
	subject?: string;
	body?: string;
}): string {
	const hasCampaignContext =
		typeof input.campaignId === 'number' &&
		input.campaignId > 0 &&
		typeof input.campaignPageId === 'number' &&
		input.campaignPageId > 0;

	const aliasToken = hasCampaignContext ? `+cmp${input.campaignId}_cp${input.campaignPageId}` : '';
	const emailAddress = `${SPEAKER_EMAIL_LOCAL_PART}${aliasToken}@${SPEAKER_EMAIL_DOMAIN}`;

	const searchParams = new URLSearchParams();

	const subject = input.subject?.trim() || DEFAULT_SPEAKER_EMAIL_SUBJECT;
	const body = input.body?.trim() || DEFAULT_SPEAKER_EMAIL_BODY;

	searchParams.set('subject', subject);
	searchParams.set('body', body);

	const queryString = searchParams.toString();

	return `mailto:${emailAddress}${queryString ? `?${queryString}` : ''}`;
}
