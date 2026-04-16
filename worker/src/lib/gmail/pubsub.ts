import { ZodError } from 'zod';
import {
	gmailPushPayloadSchema,
	pubSubPushEnvelopeSchema,
	type GmailPushPayload,
	type PubSubPushEnvelope
} from './push-schema';

const BASE64_CHARS_REGEX = /^[A-Za-z0-9+/=_-]+$/;

type PubSubParseErrorCode =
	| 'invalid_envelope'
	| 'invalid_base64'
	| 'invalid_json'
	| 'invalid_notification_payload';

export type ParsedPubSubPush = {
	envelope: PubSubPushEnvelope;
	notification: GmailPushPayload;
	emailAddress: string | null;
	historyId: string | null;
};

export type PubSubParseResult =
	| {
			ok: true;
			value: ParsedPubSubPush;
	  }
	| {
			ok: false;
			status: 400;
			code: PubSubParseErrorCode;
			error: string;
			details?: ReturnType<ZodError['flatten']>;
	  };

function decodePubSubMessageData(data: string): string {
	if (!BASE64_CHARS_REGEX.test(data)) {
		throw new Error('Invalid base64 encoding');
	}

	const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
	return atob(`${normalized}${padding}`);
}

export function parsePubSubPushEnvelope(payload: unknown): PubSubParseResult {
	const envelope = pubSubPushEnvelopeSchema.safeParse(payload);
	if (!envelope.success) {
		return {
			ok: false,
			status: 400,
			code: 'invalid_envelope',
			error: 'Validation failed',
			details: envelope.error.flatten()
		};
	}

	let decodedData = '';
	try {
		decodedData = decodePubSubMessageData(envelope.data.message.data);
	} catch {
		return {
			ok: false,
			status: 400,
			code: 'invalid_base64',
			error: 'Invalid Pub/Sub message data encoding'
		};
	}

	let decodedPayload: unknown;
	try {
		decodedPayload = JSON.parse(decodedData);
	} catch {
		return {
			ok: false,
			status: 400,
			code: 'invalid_json',
			error: 'Pub/Sub data is not valid JSON'
		};
	}

	const notification = gmailPushPayloadSchema.safeParse(decodedPayload);
	if (!notification.success) {
		return {
			ok: false,
			status: 400,
			code: 'invalid_notification_payload',
			error: 'Validation failed',
			details: notification.error.flatten()
		};
	}

	const emailAddress =
		notification.data.emailAddress ?? envelope.data.message.attributes?.emailAddress ?? null;
	const historyId =
		notification.data.historyId ?? envelope.data.message.attributes?.historyId ?? null;

	return {
		ok: true,
		value: {
			envelope: envelope.data,
			notification: notification.data,
			emailAddress,
			historyId
		}
	};
}
