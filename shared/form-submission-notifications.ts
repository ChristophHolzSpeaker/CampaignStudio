export type FormSubmissionNotificationRequest = {
	to_email: string;
	subject: string;
	body_text: string;
	metadata?: Record<string, unknown>;
};

export type FormSubmissionNotificationResponse = {
	ok: true;
	provider_message_id: string;
	provider_thread_id: string;
};
