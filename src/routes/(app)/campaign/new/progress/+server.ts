import type { RequestHandler } from '@sveltejs/kit';
import {
	subscribeToCampaignPipeline,
	type CampaignPipelineEvent
} from '$lib/server/campaign-pipeline-progress';

const encoder = new TextEncoder();

const serializeSseEvent = (event: CampaignPipelineEvent): string =>
	`event: pipeline\ndata: ${JSON.stringify(event)}\n\n`;

const serializeComment = (comment: string): string => `: ${comment}\n\n`;

export const GET: RequestHandler = async ({ url }) => {
	const runId = url.searchParams.get('runId')?.trim() ?? '';

	if (!runId) {
		return new Response('Missing runId query parameter.', { status: 400 });
	}

	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(serializeComment('campaign pipeline stream started')));

			unsubscribe = subscribeToCampaignPipeline(runId, (event) => {
				controller.enqueue(encoder.encode(serializeSseEvent(event)));

				if (event.step === 'done' || event.step === 'failed') {
					if (heartbeat) {
						clearInterval(heartbeat);
						heartbeat = null;
					}

					unsubscribe?.();
					unsubscribe = null;
					controller.close();
				}
			});

			heartbeat = setInterval(() => {
				controller.enqueue(encoder.encode(serializeComment('keepalive')));
			}, 10_000);
		},
		cancel() {
			if (heartbeat) {
				clearInterval(heartbeat);
				heartbeat = null;
			}

			unsubscribe?.();
			unsubscribe = null;
		}
	});

	return new Response(stream, {
		headers: {
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'Content-Type': 'text/event-stream'
		}
	});
};
