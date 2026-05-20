import { db } from '$lib/server/db';
import { generation_jobs } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';

export type GenerationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type GenerationJobStageName =
	| 'strategy'
	| 'architecture'
	| 'content'
	| 'media'
	| 'critique'
	| 'assembly'
	| 'edit_operations'
	| 'google_ads'
	| 'campaign_create';

type StageLevel = 'info' | 'success' | 'error';

type GenerationJobStageEvent = {
	name: GenerationJobStageName;
	status: GenerationJobStatus;
	message: string;
	level: StageLevel;
	timestamp: string;
	meta?: Record<string, unknown>;
};

type GenerationJobPayload = {
	runId?: string;
	pipeline?: string;
	stages: GenerationJobStageEvent[];
	artifacts?: Record<string, unknown>;
	metrics?: Record<string, unknown>;
};

function normalizePayload(payload: unknown): GenerationJobPayload {
	if (!payload || typeof payload !== 'object') {
		return { stages: [] };
	}

	const candidate = payload as Partial<GenerationJobPayload>;
	return {
		runId: typeof candidate.runId === 'string' ? candidate.runId : undefined,
		pipeline: typeof candidate.pipeline === 'string' ? candidate.pipeline : undefined,
		stages: Array.isArray(candidate.stages) ? candidate.stages : [],
		artifacts:
			candidate.artifacts && typeof candidate.artifacts === 'object'
				? candidate.artifacts
				: undefined,
		metrics:
			candidate.metrics && typeof candidate.metrics === 'object' ? candidate.metrics : undefined
	};
}

export async function createGenerationJob(input: {
	campaignId: number;
	runId?: string;
	pipeline?: string;
	inputPayload?: Record<string, unknown>;
}): Promise<{ id: number }> {
	const [created] = await db
		.insert(generation_jobs)
		.values({
			campaign_id: input.campaignId,
			status: 'pending',
			input_payload: input.inputPayload ?? null,
			output_payload: {
				runId: input.runId,
				pipeline: input.pipeline,
				stages: []
			},
			error_message: null,
			completed_at: null
		})
		.returning({ id: generation_jobs.id });

	if (!created) {
		throw new Error('Failed to create generation job');
	}

	return created;
}

export async function markGenerationJobStage(input: {
	jobId: number;
	stage: GenerationJobStageName;
	status: GenerationJobStatus;
	message: string;
	level?: StageLevel;
	meta?: Record<string, unknown>;
}): Promise<void> {
	const [job] = await db
		.select({ outputPayload: generation_jobs.output_payload })
		.from(generation_jobs)
		.where(eq(generation_jobs.id, input.jobId))
		.limit(1);

	if (!job) {
		throw new Error(`Generation job ${input.jobId} not found`);
	}

	const payload = normalizePayload(job.outputPayload);
	const nextEvent: GenerationJobStageEvent = {
		name: input.stage,
		status: input.status,
		message: input.message,
		level: input.level ?? (input.status === 'failed' ? 'error' : 'info'),
		timestamp: new Date().toISOString(),
		meta: input.meta
	};

	await db
		.update(generation_jobs)
		.set({
			status: input.status === 'failed' ? 'failed' : 'processing',
			output_payload: {
				...payload,
				stages: [...payload.stages, nextEvent]
			}
		})
		.where(eq(generation_jobs.id, input.jobId));
}

export async function completeGenerationJob(input: {
	jobId: number;
	outputPayload?: Record<string, unknown>;
}): Promise<void> {
	const [job] = await db
		.select({ outputPayload: generation_jobs.output_payload })
		.from(generation_jobs)
		.where(eq(generation_jobs.id, input.jobId))
		.limit(1);

	if (!job) {
		throw new Error(`Generation job ${input.jobId} not found`);
	}

	const payload = normalizePayload(job.outputPayload);
	await db
		.update(generation_jobs)
		.set({
			status: 'completed',
			output_payload: {
				...payload,
				...(input.outputPayload ?? {})
			},
			error_message: null,
			completed_at: new Date()
		})
		.where(eq(generation_jobs.id, input.jobId));
}

export async function failGenerationJob(input: {
	jobId: number;
	errorMessage: string;
	stage?: GenerationJobStageName;
	meta?: Record<string, unknown>;
}): Promise<void> {
	if (input.stage) {
		await markGenerationJobStage({
			jobId: input.jobId,
			stage: input.stage,
			status: 'failed',
			message: input.errorMessage,
			level: 'error',
			meta: input.meta
		});
	}

	await db
		.update(generation_jobs)
		.set({
			status: 'failed',
			error_message: input.errorMessage,
			completed_at: new Date()
		})
		.where(eq(generation_jobs.id, input.jobId));
}

export async function listGenerationJobsForCampaign(campaignId: number, limit = 20) {
	return db
		.select({
			id: generation_jobs.id,
			status: generation_jobs.status,
			inputPayload: generation_jobs.input_payload,
			outputPayload: generation_jobs.output_payload,
			errorMessage: generation_jobs.error_message,
			createdAt: generation_jobs.created_at,
			completedAt: generation_jobs.completed_at
		})
		.from(generation_jobs)
		.where(eq(generation_jobs.campaign_id, campaignId))
		.orderBy(desc(generation_jobs.created_at))
		.limit(limit);
}

export async function getGenerationJobForCampaign(campaignId: number, jobId: number) {
	const [job] = await db
		.select({
			id: generation_jobs.id,
			status: generation_jobs.status,
			inputPayload: generation_jobs.input_payload,
			outputPayload: generation_jobs.output_payload,
			errorMessage: generation_jobs.error_message,
			createdAt: generation_jobs.created_at,
			completedAt: generation_jobs.completed_at
		})
		.from(generation_jobs)
		.where(and(eq(generation_jobs.id, jobId), eq(generation_jobs.campaign_id, campaignId)))
		.limit(1);

	return job ?? null;
}
