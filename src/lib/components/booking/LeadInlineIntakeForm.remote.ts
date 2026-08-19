import { form, getRequestEvent } from '$app/server';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { resolveCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { submitLeadIntake } from '$lib/server/leads/intake-service';
import { bookingIntakeSchema, getBookingIntakeSubmission } from '$lib/validation/booking-intake';

function readSingleString(input: unknown): string | undefined {
	if (typeof input === 'string') return input;
	if (Array.isArray(input)) return typeof input[0] === 'string' ? input[0] : undefined;
	return undefined;
}

export const submitInlineLeadIntake = form('unchecked', async (rawData) => {
	const event = getRequestEvent();
	const formData = new FormData();
	for (const [key, value] of Object.entries(rawData))
		formData.set(key, readSingleString(value) ?? '');
	const parsed = bookingIntakeSchema.safeParse(getBookingIntakeSubmission(formData));
	if (!parsed.success)
		return {
			success: false,
			message: parsed.error.issues[0]?.message ?? 'Bitte pruefen Sie Ihre Angaben.'
		};
	const campaignId = Number(readSingleString(rawData.campaignId));
	const campaignPageId = Number(readSingleString(rawData.campaignPageId));
	if (!Number.isInteger(campaignId) || !Number.isInteger(campaignPageId))
		return { success: false, message: 'Fehlender Seitenkontext. Bitte laden Sie die Seite neu.' };
	const context = await resolveCampaignPageContext({ campaignId, campaignPageId });
	if (!context)
		return { success: false, message: 'Die Anfrage kann derzeit nicht verarbeitet werden.' };
	try {
		await submitLeadIntake({
			intake: parsed.data,
			campaignId: context.campaignId,
			campaignPageId: context.campaignPageId,
			visitorIdentifier: readVisitorIdentifier(event.cookies),
			pageSlug: readSingleString(rawData.pageSlug) ?? null,
			pagePath: event.url.pathname,
			surface: readSingleString(rawData.bookingSurface) ?? 'inline_intake',
			eventSource: 'sveltekit.inline_lead_intake',
			formType: 'inline_lead_intake',
			notificationFlow: 'inline_lead_intake',
			logJourneyCreated: true,
			cta: {
				key: readSingleString(rawData.ctaKey),
				section: readSingleString(rawData.ctaSection),
				variant: readSingleString(rawData.ctaVariant)
			}
		});
		return {
			success: true,
			message:
				'Vielen Dank fuer Ihre Anfrage. Woody prueft Ihre Angaben und meldet sich per E-Mail mit dem naechsten Schritt. Wenn Ihre Anfrage passt, erhalten Sie einen Link zur Terminbuchung.'
		};
	} catch (error) {
		return {
			success: false,
			message:
				error instanceof Error ? error.message : 'Die Anfrage konnte nicht verarbeitet werden.'
		};
	}
});
