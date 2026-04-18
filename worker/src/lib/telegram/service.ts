import type { WorkerEnv } from '../env';
import type { TelegramNotificationRequest } from '../../../../shared/telegram-notifications';
import { sendTelegramChannelMessage } from './client';
import { formatTelegramNotification } from './format';

export async function sendTelegramNotification(
	env: WorkerEnv,
	input: TelegramNotificationRequest
): Promise<{ message_id?: number }> {
	const text = formatTelegramNotification(input);
	return sendTelegramChannelMessage(env, { text });
}
