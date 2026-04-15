import type { WorkerEnv } from '../env';
import { generateWoodyReply } from './generate-reply';
import type { WoodyGenerateReplyInput, WoodyGenerateReplyOutput } from './types';

export async function invokeWoodyAcknowledgement(
	env: WorkerEnv,
	input: WoodyGenerateReplyInput
): Promise<WoodyGenerateReplyOutput> {
	return generateWoodyReply(env, input);
}
