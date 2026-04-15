export type InboundInquiryClassification =
	| 'speaking_inquiry'
	| 'not_speaking_inquiry'
	| 'uncertain';

export type InboundClassificationResult = {
	classification: InboundInquiryClassification;
	classification_confidence: number;
	reason: string;
};

export type InboundMessageForClassification = {
	subject: string;
	body_text: string;
};

const POSITIVE_SIGNALS = [
	'speak',
	'speaking',
	'keynote',
	'workshop',
	'conference',
	'event',
	'availability',
	'fee',
	'book you',
	'invite',
	'talk',
	'presentation'
] as const;

const NEGATIVE_SIGNALS = [
	'unsubscribe',
	'out of office',
	'autoreply',
	'auto-reply',
	'delivery failure',
	'undeliverable',
	'mailer-daemon',
	'newsletter'
] as const;

function countMatches(text: string, signals: readonly string[]): number {
	let count = 0;
	for (const signal of signals) {
		if (text.includes(signal)) {
			count += 1;
		}
	}
	return count;
}

export function classifyInboundMessage(
	message: InboundMessageForClassification
): InboundClassificationResult {
	const text = `${message.subject}\n${message.body_text}`.trim().toLowerCase();
	if (!text) {
		return {
			classification: 'uncertain',
			classification_confidence: 0.2,
			reason: 'empty_content'
		};
	}

	const positiveCount = countMatches(text, POSITIVE_SIGNALS);
	const negativeCount = countMatches(text, NEGATIVE_SIGNALS);

	if (negativeCount > 0 && positiveCount === 0) {
		return {
			classification: 'not_speaking_inquiry',
			classification_confidence: 0.85,
			reason: 'negative_signal_match'
		};
	}

	if (positiveCount >= 2) {
		return {
			classification: 'speaking_inquiry',
			classification_confidence: 0.9,
			reason: 'strong_positive_signals'
		};
	}

	if (positiveCount === 1 && negativeCount === 0) {
		return {
			classification: 'speaking_inquiry',
			classification_confidence: 0.7,
			reason: 'single_positive_signal'
		};
	}

	if (positiveCount === 0 && negativeCount > 0) {
		return {
			classification: 'not_speaking_inquiry',
			classification_confidence: 0.75,
			reason: 'negative_bias'
		};
	}

	return {
		classification: 'uncertain',
		classification_confidence: 0.5,
		reason: 'insufficient_signal'
	};
}
