import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getGenerationJobForCampaign,
	listGenerationJobsForCampaign
} from '$lib/server/generation-jobs';

export const GET: RequestHandler = async ({ params, url }) => {
	const campaignId = Number(params.id);
	if (!Number.isFinite(campaignId) || campaignId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const jobIdParam = url.searchParams.get('jobId');
	if (jobIdParam) {
		const jobId = Number(jobIdParam);
		if (!Number.isFinite(jobId) || jobId <= 0) {
			throw error(400, 'Invalid job id');
		}

		const job = await getGenerationJobForCampaign(campaignId, jobId);
		if (!job) {
			throw error(404, 'Generation job not found');
		}

		return json({ job });
	}

	const limitParam = url.searchParams.get('limit');
	const limit = limitParam ? Number(limitParam) : 20;
	if (!Number.isFinite(limit) || limit <= 0 || limit > 100) {
		throw error(400, 'Invalid limit');
	}

	const jobs = await listGenerationJobsForCampaign(campaignId, limit);
	return json({ jobs });
};
