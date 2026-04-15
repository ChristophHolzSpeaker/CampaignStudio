import { selectOne } from '../db';
import type { WorkerEnv } from '../env';
import type { InboundClassificationResult } from './classify-message';

type LeadJourneyAutoresponseState = {
	id: string;
	auto_response_sent_at: string | null;
};

export type AutoResponseDecision =
	| 'eligible_for_autoresponse'
	| 'do_not_autorespond_internal_sender'
	| 'do_not_autorespond_not_inquiry'
	| 'do_not_autorespond_uncertain'
	| 'do_not_autorespond_already_sent';

export type InboundAutoResponseDecisionResult = {
	classification: InboundClassificationResult['classification'] | null;
	classification_confidence: number | null;
	auto_response_decision: AutoResponseDecision;
	eligible_for_autoresponse: boolean;
	skipped_reason: string | null;
	lead_journey_id: string;
	lead_message_id: string;
};

async function loadJourneyResponseState(
	env: WorkerEnv,
	leadJourneyId: string
): Promise<LeadJourneyAutoresponseState | null> {
	const query = new URLSearchParams({
		select: 'id,auto_response_sent_at',
		id: `eq.${leadJourneyId}`,
		limit: '1'
	});

	return selectOne<LeadJourneyAutoresponseState>(env, 'lead_journeys', query);
}

export async function evaluateInboundAutoResponseDecision(
	env: WorkerEnv,
	input: {
		lead_journey_id: string;
		lead_message_id: string;
		is_internal_sender: boolean;
		classification: InboundClassificationResult | null;
	}
): Promise<InboundAutoResponseDecisionResult> {
	const journey = await loadJourneyResponseState(env, input.lead_journey_id);
	if (!journey) {
		throw new Error(`Lead journey not found for autoresponse decision: ${input.lead_journey_id}`);
	}

	if (input.is_internal_sender) {
		return {
			classification: null,
			classification_confidence: null,
			auto_response_decision: 'do_not_autorespond_internal_sender',
			eligible_for_autoresponse: false,
			skipped_reason: 'internal_sender',
			lead_journey_id: input.lead_journey_id,
			lead_message_id: input.lead_message_id
		};
	}

	if (journey.auto_response_sent_at) {
		return {
			classification: input.classification?.classification ?? null,
			classification_confidence: input.classification?.classification_confidence ?? null,
			auto_response_decision: 'do_not_autorespond_already_sent',
			eligible_for_autoresponse: false,
			skipped_reason: 'already_sent',
			lead_journey_id: input.lead_journey_id,
			lead_message_id: input.lead_message_id
		};
	}

	if (!input.classification || input.classification.classification === 'uncertain') {
		return {
			classification: input.classification?.classification ?? 'uncertain',
			classification_confidence: input.classification?.classification_confidence ?? 0,
			auto_response_decision: 'do_not_autorespond_uncertain',
			eligible_for_autoresponse: false,
			skipped_reason: 'uncertain',
			lead_journey_id: input.lead_journey_id,
			lead_message_id: input.lead_message_id
		};
	}

	if (input.classification.classification !== 'speaking_inquiry') {
		return {
			classification: input.classification.classification,
			classification_confidence: input.classification.classification_confidence,
			auto_response_decision: 'do_not_autorespond_not_inquiry',
			eligible_for_autoresponse: false,
			skipped_reason: 'not_speaking_inquiry',
			lead_journey_id: input.lead_journey_id,
			lead_message_id: input.lead_message_id
		};
	}

	return {
		classification: input.classification.classification,
		classification_confidence: input.classification.classification_confidence,
		auto_response_decision: 'eligible_for_autoresponse',
		eligible_for_autoresponse: true,
		skipped_reason: null,
		lead_journey_id: input.lead_journey_id,
		lead_message_id: input.lead_message_id
	};
}
