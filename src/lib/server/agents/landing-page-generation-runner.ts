import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';

type RunnerInput = {
	systemPrompt: string;
	userPrompt: string;
	traceContext: LlmTraceContext;
};

export async function runLandingPageWriterGeneration({
	systemPrompt,
	userPrompt,
	traceContext
}: RunnerInput): Promise<unknown> {
	console.log('Landing page writer: calling OpenRouter');
	traceLlm(
		'agent_stage_start',
		{ ...traceContext, stage: 'landing_page_writer' },
		{
			model: 'google/gemini-3.1-flash-lite-preview'
		}
	);

	try {
		const response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite',
			systemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'landing_page_writer' }
		});
		console.log('Landing page writer: OpenRouter responded');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				responsePreview: JSON.stringify(response)
			}
		);
		traceLlm('writer_output', { ...traceContext, stage: 'landing_page_writer' }, { response });
		return response;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Landing page writer: OpenRouter error', message);
		traceLlm('agent_stage_error', { ...traceContext, stage: 'landing_page_writer' }, { message });
		throw new Error(`Landing page writer failed: ${message}`);
	}
}

export async function runLandingPageWriterRepair({
	systemPrompt,
	userPrompt,
	traceContext
}: RunnerInput): Promise<unknown> {
	console.log('Landing page writer: requesting repair pass');
	traceLlm(
		'repair_pass_triggered',
		{ ...traceContext, stage: 'landing_page_writer_repair' },
		{
			reason: 'writer_validation_failed'
		}
	);

	try {
		const repairedResponse = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'landing_page_writer_repair' }
		});
		console.log('Landing page writer: repair response received');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'landing_page_writer_repair' },
			{
				responsePreview: JSON.stringify(repairedResponse)
			}
		);
		traceLlm(
			'writer_output',
			{ ...traceContext, stage: 'landing_page_writer_repair' },
			{
				response: repairedResponse
			}
		);
		return repairedResponse;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		traceLlm(
			'agent_stage_error',
			{ ...traceContext, stage: 'landing_page_writer_repair' },
			{
				message
			}
		);
		throw new Error(`Landing page writer repair failed: ${message}`);
	}
}
