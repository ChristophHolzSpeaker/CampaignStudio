type CampaignPipelineStep =
	| 'queued'
	| 'saving_campaign'
	| 'campaign_saved'
	| 'generating_google_ads'
	| 'google_ads_done'
	| 'generating_landing_page'
	| 'landing_page_done'
	| 'done'
	| 'failed';

export type CampaignPipelineEvent = {
	runId: string;
	step: CampaignPipelineStep;
	message: string;
	level: 'info' | 'success' | 'error';
	timestamp: string;
};

type Subscriber = (event: CampaignPipelineEvent) => void;

type PipelineRun = {
	events: CampaignPipelineEvent[];
	subscribers: Set<Subscriber>;
	done: boolean;
	createdAt: number;
	cleanupTimeout: ReturnType<typeof setTimeout> | null;
};

const RETAIN_COMPLETED_RUNS_MS = 5 * 60 * 1000;
const MAX_EVENT_HISTORY = 30;

const runs = new Map<string, PipelineRun>();

const getOrCreateRun = (runId: string): PipelineRun => {
	const existing = runs.get(runId);
	if (existing) {
		if (existing.cleanupTimeout) {
			clearTimeout(existing.cleanupTimeout);
			existing.cleanupTimeout = null;
		}

		return existing;
	}

	const created: PipelineRun = {
		events: [],
		subscribers: new Set(),
		done: false,
		createdAt: Date.now(),
		cleanupTimeout: null
	};

	runs.set(runId, created);
	return created;
};

const scheduleCleanupIfDone = (runId: string): void => {
	const run = runs.get(runId);
	if (!run || !run.done || run.cleanupTimeout) {
		return;
	}

	run.cleanupTimeout = setTimeout(() => {
		runs.delete(runId);
	}, RETAIN_COMPLETED_RUNS_MS);
};

export const publishCampaignPipelineEvent = (
	runId: string,
	event: Omit<CampaignPipelineEvent, 'runId' | 'timestamp'>
): void => {
	const run = getOrCreateRun(runId);
	const fullEvent: CampaignPipelineEvent = {
		runId,
		timestamp: new Date().toISOString(),
		...event
	};

	run.events.push(fullEvent);
	if (run.events.length > MAX_EVENT_HISTORY) {
		run.events.shift();
	}

	for (const subscriber of run.subscribers) {
		subscriber(fullEvent);
	}

	if (event.step === 'done' || event.step === 'failed') {
		run.done = true;
		scheduleCleanupIfDone(runId);
	}
};

export const subscribeToCampaignPipeline = (runId: string, onEvent: Subscriber): (() => void) => {
	const run = getOrCreateRun(runId);

	for (const event of run.events) {
		onEvent(event);
	}

	run.subscribers.add(onEvent);

	if (run.done) {
		scheduleCleanupIfDone(runId);
	}

	return () => {
		const currentRun = runs.get(runId);
		if (!currentRun) {
			return;
		}

		currentRun.subscribers.delete(onEvent);
		scheduleCleanupIfDone(runId);
	};
};

export const hasCampaignPipelineRun = (runId: string): boolean => runs.has(runId);
