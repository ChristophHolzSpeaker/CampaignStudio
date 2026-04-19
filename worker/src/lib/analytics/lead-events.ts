import type { EventType } from '../../../../shared/event-types';
import { insertOne } from '../db';
import type { WorkerEnv } from '../env';

export type WorkerLeadEventInput = {
	lead_journey_id?: string | null;
	campaign_id?: number | null;
	campaign_page_id?: number | null;
	event_type: EventType;
	event_source: string;
	event_payload?: Record<string, unknown>;
	session_id?: string | null;
	anonymous_id?: string | null;
	occurred_at?: string;
	cta_key?: string | null;
	cta_label?: string | null;
	cta_section?: string | null;
	cta_variant?: string | null;
};

export async function logLeadEvent(env: WorkerEnv, input: WorkerLeadEventInput): Promise<void> {
	await insertOne(env, 'lead_events', {
		lead_journey_id: input.lead_journey_id ?? null,
		campaign_id: input.campaign_id ?? null,
		campaign_page_id: input.campaign_page_id ?? null,
		event_type: input.event_type,
		event_source: input.event_source,
		event_payload: input.event_payload ?? {},
		session_id: input.session_id ?? null,
		anonymous_id: input.anonymous_id ?? null,
		occurred_at: input.occurred_at ?? new Date().toISOString(),
		cta_key: input.cta_key ?? null,
		cta_label: input.cta_label ?? null,
		cta_section: input.cta_section ?? null,
		cta_variant: input.cta_variant ?? null
	});
}
