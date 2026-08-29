import { z } from 'zod';
import { callOpenRouter } from '$lib/server/openrouter/client';
import type { BookingLinkInviteEmailContext } from './contracts';

const SUMMARY_MODEL = 'google/gemini-3.1-flash-lite-preview';
const TO_BE_DETERMINED = 'To be determined';

const extractedLeadInviteSummarySchema = z.object({
	greeting: z.string(),
	location: z.string(),
	date_time: z.string(),
	event_name: z.string(),
	audience: z.string(),
	topic: z.string(),
	requester: z.string(),
	organization: z.string()
});

export type LeadInviteSummary = {
	greeting: string;
	location: string;
	dateTime: string;
	eventName: string;
	audience: string;
	topic: string;
	requester: string;
	organization: string;
};

type LeadInviteCopy = {
	subject: string;
	introduction: string;
	summaryIntroduction: string;
	labels: readonly [string, string, string, string, string, string, string];
	reviewMessage: string;
	bookingMessage: string;
	bookingLinkLabel: string;
	bookingLinkFallback: string;
	thanks: string;
	signoff: string;
	assistantTitle: string;
};

function normalizeLanguageTag(language: string): string {
	const normalized = language.trim().toLowerCase();
	if (normalized.startsWith('de') || normalized === 'german') return 'de';
	if (normalized.startsWith('fr') || normalized === 'french') return 'fr';
	if (normalized.startsWith('es') || normalized === 'spanish') return 'es';
	return 'en';
}

function normalizeSummaryValue(value: string | null | undefined): string {
	const normalized = value?.replace(/\s+/g, ' ').trim();
	if (!normalized || /^(tbd|unknown|not provided|nicht angegeben|unbekannt)$/i.test(normalized)) {
		return TO_BE_DETERMINED;
	}
	return normalized;
}

function getDefaultGreeting(context: BookingLinkInviteEmailContext): string {
	const name = normalizeSummaryValue(context.recipientName);
	switch (normalizeLanguageTag(context.language)) {
		case 'de':
			return name === TO_BE_DETERMINED ? 'Sehr geehrte Damen und Herren,' : `Guten Tag ${name},`;
		case 'fr':
			return name === TO_BE_DETERMINED ? 'Madame, Monsieur,' : `Bonjour ${name},`;
		case 'es':
			return name === TO_BE_DETERMINED ? 'Estimados señores:' : `Hola ${name}:`;
		default:
			return name === TO_BE_DETERMINED ? 'Hello,' : `Hello ${name},`;
	}
}

function normalizeGreeting(
	value: string | null | undefined,
	context: BookingLinkInviteEmailContext
): string {
	const normalized = value?.replace(/[\r\n]+/g, ' ').trim();
	if (!normalized || normalized === TO_BE_DETERMINED) return getDefaultGreeting(context);
	return /[,:]$/.test(normalized) ? normalized : `${normalized},`;
}

function fallbackSummary(context: BookingLinkInviteEmailContext): LeadInviteSummary {
	return {
		greeting: getDefaultGreeting(context),
		location: TO_BE_DETERMINED,
		dateTime: TO_BE_DETERMINED,
		eventName: TO_BE_DETERMINED,
		audience: TO_BE_DETERMINED,
		topic: TO_BE_DETERMINED,
		requester: normalizeSummaryValue(context.recipientName),
		organization: normalizeSummaryValue(context.organization)
	};
}

export function buildLeadInviteSummaryPrompt(context: BookingLinkInviteEmailContext): {
	systemPrompt: string;
	userPrompt: string;
} {
	return {
		systemPrompt: `Extract structured facts from a speaking-engagement inquiry.
Return STRICT JSON only with this shape:
{
  "greeting": string,
  "location": string,
  "date_time": string,
  "event_name": string,
  "audience": string,
  "topic": string,
  "requester": string,
  "organization": string
}

Rules:
- Never invent facts or certainty.
- Use exactly "${TO_BE_DETERMINED}" for every value that cannot be extracted.
- Keep proper names exactly as supplied.
- Prefer the structured requester and organization when supplied.
- Express extracted values concisely in the requested response language.
- For German, use a formal personalized greeting such as "Sehr geehrter Herr Stevenson," only when the name or title supports it; otherwise use a polite gender-neutral greeting.
- The greeting must be complete, appropriate for the requested language, and end with punctuation.
- Do not include explanations, markdown, or fields beyond the schema.`,
		userPrompt: JSON.stringify(
			{
				response_language: context.language,
				requester: context.recipientName,
				organization: context.organization,
				inquiry: context.requestSummary ?? context.meetingScope
			},
			null,
			2
		)
	};
}

export async function extractLeadInviteSummary(
	context: BookingLinkInviteEmailContext
): Promise<LeadInviteSummary> {
	const fallback = fallbackSummary(context);
	if (!context.requestSummary && !context.meetingScope) return fallback;

	try {
		const prompt = buildLeadInviteSummaryPrompt(context);
		const raw = await callOpenRouter({
			model: SUMMARY_MODEL,
			systemPrompt: prompt.systemPrompt,
			userPrompt: prompt.userPrompt,
			responseFormat: 'json_object'
		});
		const extracted = extractedLeadInviteSummarySchema.parse(raw);

		return {
			greeting: normalizeGreeting(extracted.greeting, context),
			location: normalizeSummaryValue(extracted.location),
			dateTime: normalizeSummaryValue(extracted.date_time),
			eventName: normalizeSummaryValue(extracted.event_name),
			audience: normalizeSummaryValue(extracted.audience),
			topic: normalizeSummaryValue(extracted.topic),
			requester: normalizeSummaryValue(context.recipientName ?? extracted.requester),
			organization: normalizeSummaryValue(context.organization ?? extracted.organization)
		};
	} catch (error) {
		console.error('woody_lead_invite_summary_extraction_failed', {
			leadJourneyId: context.leadJourneyId,
			error: error instanceof Error ? error.message : 'unknown_error'
		});
		return fallback;
	}
}

function getCopy(language: string): LeadInviteCopy {
	switch (normalizeLanguageTag(language)) {
		case 'de':
			return {
				subject: 'Ihre Buchungsanfrage ist eingegangen – wählen Sie Ihren Termin',
				introduction:
					'vielen Dank für Ihre freundliche Anfrage und das Interesse an Herrn Christoph Holz als Hauptredner für Ihre Veranstaltung. Ich bin Woody, der KI-Assistent von Herrn Holz, und unterstütze ihn bei der Bearbeitung seiner Anfragen.',
				summaryIntroduction: 'Hier eine kurze Zusammenfassung Ihrer Anfrage:',
				labels: [
					'Ort',
					'Datum und Uhrzeit',
					'Veranstaltungsname',
					'Publikum',
					'Thema',
					'Anfragender',
					'Organisation'
				],
				reviewMessage:
					'Herr Holz wird Ihre Anfrage prüfen und wir melden uns zeitnah mit einer Rückmeldung.',
				bookingMessage:
					'Sollten Sie in der Zwischenzeit ein Gespräch planen wollen, können Sie gerne einen Termin über den folgenden Link buchen:',
				bookingLinkLabel: 'Videoanruf planen',
				bookingLinkFallback: 'Falls der Link nicht funktioniert',
				thanks: 'Vielen Dank für Ihre Anfrage und Ihr Vertrauen.',
				signoff: 'Mit freundlichen Grüßen,',
				assistantTitle: 'KI-Assistent von Christoph Holz'
			};
		case 'fr':
			return {
				subject: 'Votre demande de réservation est bien arrivée – choisissez votre créneau',
				introduction:
					"merci pour votre aimable demande et l'intérêt que vous portez à Christoph Holz comme conférencier principal. Je suis Woody, son assistant IA, et je l'aide à traiter ses demandes.",
				summaryIntroduction: 'Voici un bref résumé de votre demande :',
				labels: [
					'Lieu',
					'Date et heure',
					'Nom de l’événement',
					'Public',
					'Thème',
					'Demandeur',
					'Organisation'
				],
				reviewMessage: 'Christoph examinera votre demande et nous vous répondrons prochainement.',
				bookingMessage:
					'Si vous souhaitez organiser un entretien entre-temps, vous pouvez choisir un créneau via le lien suivant :',
				bookingLinkLabel: 'Planifier un appel vidéo',
				bookingLinkFallback: 'Si le lien ne fonctionne pas',
				thanks: 'Merci pour votre demande et votre confiance.',
				signoff: 'Cordialement,',
				assistantTitle: 'Assistant IA de Christoph Holz'
			};
		case 'es':
			return {
				subject: 'Hemos recibido tu solicitud de reserva – elige tu horario',
				introduction:
					'gracias por su amable consulta y por su interés en Christoph Holz como ponente principal. Soy Woody, su asistente de IA, y le ayudo a gestionar sus solicitudes.',
				summaryIntroduction: 'A continuación encontrará un breve resumen de su solicitud:',
				labels: [
					'Lugar',
					'Fecha y hora',
					'Nombre del evento',
					'Público',
					'Tema',
					'Solicitante',
					'Organización'
				],
				reviewMessage:
					'Christoph revisará su solicitud y nos pondremos en contacto con usted en breve.',
				bookingMessage:
					'Si desea programar una conversación mientras tanto, puede reservar una cita mediante el siguiente enlace:',
				bookingLinkLabel: 'Programar videollamada',
				bookingLinkFallback: 'Si el enlace no funciona',
				thanks: 'Gracias por su solicitud y su confianza.',
				signoff: 'Atentamente,',
				assistantTitle: 'Asistente de IA de Christoph Holz'
			};
		default:
			return {
				subject: 'Your booking request is in - choose your time',
				introduction:
					'thank you for your kind inquiry and your interest in Christoph Holz as the keynote speaker for your event. I am Woody, his AI assistant, and I help him coordinate incoming requests.',
				summaryIntroduction: 'Here is a short summary of your inquiry:',
				labels: [
					'Location',
					'Date and time',
					'Event name',
					'Audience',
					'Topic',
					'Requester',
					'Organization'
				],
				reviewMessage: 'Christoph will review your inquiry and we will get back to you shortly.',
				bookingMessage:
					'If you would like to arrange a conversation in the meantime, you can book a time using the following link:',
				bookingLinkLabel: 'Schedule a video call',
				bookingLinkFallback: 'If the link does not work',
				thanks: 'Thank you for your inquiry and your trust.',
				signoff: 'Kind regards,',
				assistantTitle: 'AI Assistant to Christoph Holz'
			};
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function composeBookingLinkInviteEmail(
	context: BookingLinkInviteEmailContext,
	summary: LeadInviteSummary = fallbackSummary(context)
): { subject: string; bodyText: string; bodyHtml: string } {
	const copy = getCopy(context.language);
	const values = [
		summary.location,
		summary.dateTime,
		summary.eventName,
		summary.audience,
		summary.topic,
		summary.requester,
		summary.organization
	].map(normalizeSummaryValue);
	const textSummary = copy.labels.map((label, index) => `- ${label}: ${values[index]}`);
	const htmlSummary = copy.labels
		.map(
			(label, index) =>
				`<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(values[index])}</li>`
		)
		.join('');
	const safeBookingUrl = escapeHtml(context.bookingLinkUrl);

	return {
		subject: copy.subject,
		bodyText: [
			summary.greeting,
			'',
			copy.introduction,
			'',
			copy.summaryIntroduction,
			'',
			...textSummary,
			'',
			copy.reviewMessage,
			copy.bookingMessage,
			'',
			copy.bookingLinkLabel,
			context.bookingLinkUrl,
			'',
			copy.thanks,
			'',
			copy.signoff,
			'Woody',
			copy.assistantTitle
		].join('\n'),
		bodyHtml: [
			`<p>${escapeHtml(summary.greeting)}</p>`,
			`<p>${escapeHtml(copy.introduction)}</p>`,
			`<p>${escapeHtml(copy.summaryIntroduction)}</p>`,
			`<ul>${htmlSummary}</ul>`,
			`<p>${escapeHtml(copy.reviewMessage)} ${escapeHtml(copy.bookingMessage)}</p>`,
			`<p><a href="${safeBookingUrl}">${escapeHtml(copy.bookingLinkLabel)}</a><br/>${escapeHtml(copy.bookingLinkFallback)}: <a href="${safeBookingUrl}">${safeBookingUrl}</a></p>`,
			`<p>${escapeHtml(copy.thanks)}</p>`,
			`<p>${escapeHtml(copy.signoff)}<br/>Woody<br/>${escapeHtml(copy.assistantTitle)}</p>`
		].join('')
	};
}

export { TO_BE_DETERMINED as WOODY_TO_BE_DETERMINED };
