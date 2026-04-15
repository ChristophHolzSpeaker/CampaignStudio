import type { WorkerEnv } from '../env';
import { getGmailAccessToken } from './auth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export type GmailHeader = {
	name?: string;
	value?: string;
};

export type GmailMessagePart = {
	partId?: string;
	mimeType?: string;
	filename?: string;
	headers?: GmailHeader[];
	body?: {
		size?: number;
		data?: string;
		attachmentId?: string;
	};
	parts?: GmailMessagePart[];
};

export type GmailMessage = {
	id: string;
	threadId: string;
	labelIds?: string[];
	historyId?: string;
	internalDate?: string;
	snippet?: string;
	payload?: GmailMessagePart;
};

export type GmailHistoryEntry = {
	id?: string;
	messagesAdded?: Array<{
		message?: {
			id?: string;
			threadId?: string;
		};
	}>;
};

export type GmailHistoryListResponse = {
	history?: GmailHistoryEntry[];
	historyId?: string;
	nextPageToken?: string;
};

export class GmailApiError extends Error {
	status: number;
	body: unknown;

	constructor(status: number, message: string, body: unknown) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

export function isHistoryCursorStale(error: unknown): boolean {
	if (!(error instanceof GmailApiError)) {
		return false;
	}

	if (error.status === 404) {
		return true;
	}

	if (error.status !== 400) {
		return false;
	}

	const details = JSON.stringify(error.body).toLowerCase();
	return details.includes('stale') || details.includes('invalid') || details.includes('history');
}

async function gmailRequest<T>(
	env: WorkerEnv,
	delegatedUser: string,
	path: string,
	options: {
		method?: 'GET' | 'POST';
		query?: URLSearchParams;
		body?: unknown;
	}
): Promise<T> {
	const accessToken = await getGmailAccessToken(env, delegatedUser);
	const url = new URL(`${GMAIL_API_BASE}${path}`);
	if (options.query) {
		url.search = options.query.toString();
	}

	const response = await fetch(url.toString(), {
		method: options.method ?? 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined
	});

	if (!response.ok) {
		let body: unknown;
		const text = await response.text();
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
		throw new GmailApiError(
			response.status,
			`Gmail API request failed (${response.status}) ${options.method ?? 'GET'} ${path}`,
			body
		);
	}

	if (response.status === 204) {
		return {} as T;
	}

	return (await response.json()) as T;
}

export async function gmailListHistory(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		startHistoryId: string;
		pageToken?: string;
	}
): Promise<GmailHistoryListResponse> {
	const query = new URLSearchParams({
		startHistoryId: params.startHistoryId,
		historyTypes: 'messageAdded',
		maxResults: '100'
	});

	if (params.pageToken) {
		query.set('pageToken', params.pageToken);
	}

	return gmailRequest<GmailHistoryListResponse>(env, params.gmailUser, '/users/me/history', {
		method: 'GET',
		query
	});
}

export async function gmailGetMessage(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		messageId: string;
	}
): Promise<GmailMessage> {
	const query = new URLSearchParams({ format: 'full' });
	return gmailRequest<GmailMessage>(
		env,
		params.gmailUser,
		`/users/me/messages/${encodeURIComponent(params.messageId)}`,
		{
			method: 'GET',
			query
		}
	);
}

export async function gmailSendMessage(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		raw: string;
		threadId?: string;
	}
): Promise<{ id: string; threadId: string }> {
	return gmailRequest<{ id: string; threadId: string }>(
		env,
		params.gmailUser,
		'/users/me/messages/send',
		{
			method: 'POST',
			body: {
				raw: params.raw,
				threadId: params.threadId
			}
		}
	);
}

export async function gmailWatch(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		topicName: string;
		labelIds?: string[];
		labelFilterAction?: 'include' | 'exclude';
	}
): Promise<{ historyId?: string; expiration?: string }> {
	return gmailRequest<{ historyId?: string; expiration?: string }>(
		env,
		params.gmailUser,
		'/users/me/watch',
		{
			method: 'POST',
			body: {
				topicName: params.topicName,
				labelIds: params.labelIds,
				labelFilterAction: params.labelFilterAction
			}
		}
	);
}
