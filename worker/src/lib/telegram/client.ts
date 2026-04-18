import type { WorkerEnv } from '../env';
import { requireEnv } from '../env';

type TelegramSendMessageApiResponse = {
	ok: boolean;
	description?: string;
	result?: {
		message_id?: number;
	};
};

export async function sendTelegramChannelMessage(
	env: WorkerEnv,
	input: {
		text: string;
	}
): Promise<{ message_id?: number }> {
	const token = requireEnv(env, 'TELEGRAM_BOT_TOKEN');
	const chatId = requireEnv(env, 'TELEGRAM_CHAT_ID');
	const url = `https://api.telegram.org/bot${token}/sendMessage`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			chat_id: chatId,
			text: input.text,
			disable_web_page_preview: true
		})
	});

	let payload: TelegramSendMessageApiResponse | null = null;
	let rawBody = '';

	try {
		rawBody = await response.text();
		payload = JSON.parse(rawBody) as TelegramSendMessageApiResponse;
	} catch {
		payload = null;
	}

	if (!response.ok || !payload?.ok) {
		const statusLabel = `status=${response.status}`;
		const description = (payload?.description ?? rawBody) || 'Unknown Telegram API error';
		throw new Error(`Telegram send failed (${statusLabel}): ${description}`);
	}

	return {
		message_id: payload.result?.message_id
	};
}
