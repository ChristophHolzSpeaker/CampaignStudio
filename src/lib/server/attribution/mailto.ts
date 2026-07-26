import { SPEAKER_EMAIL } from '../../../../shared/speaker-email';

export const DEFAULT_SPEAKER_EMAIL_SUBJECT = 'Anfrage für einen Vortrag';

export const DEFAULT_SPEAKER_EMAIL_BODY = `Lieber Christoph Holz!

Wir planen einen Event:
Datum und Uhrzeit:
Veranstaltungsort:

Bitte um Kontaktaufnahme.`;

export function buildSpeakerMailtoHref(input: {
	campaignPageId: number | null;
	subject?: string;
	body?: string;
}): string {
	const hasCampaignPageContext =
		typeof input.campaignPageId === 'number' && input.campaignPageId > 0;
	const aliasToken = hasCampaignPageContext ? `+${input.campaignPageId}` : '';
	const [localPart, domain] = SPEAKER_EMAIL.campaignStudio.split('@');
	const emailAddress = `${localPart}${aliasToken}@${domain}`;

	const searchParams = new URLSearchParams();

	const subject = input.subject?.trim() || DEFAULT_SPEAKER_EMAIL_SUBJECT;
	const body = input.body?.trim() || DEFAULT_SPEAKER_EMAIL_BODY;

	searchParams.set('subject', subject);
	searchParams.set('body', body);

	const queryString = searchParams.toString();

	return `mailto:${emailAddress}${queryString ? `?${queryString}` : ''}`;
}
