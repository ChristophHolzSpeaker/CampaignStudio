export type GoogleAuthErrorCode =
	| 'MISSING_ENV_VAR'
	| 'INVALID_ENV_VAR'
	| 'INVALID_PRIVATE_KEY'
	| 'JWT_SIGNING_FAILED'
	| 'TOKEN_EXCHANGE_FAILED'
	| 'INVALID_TOKEN_RESPONSE'
	| 'INVALID_SCOPE';

export class GoogleAuthError extends Error {
	readonly code: GoogleAuthErrorCode;
	readonly details?: Record<string, unknown>;

	constructor(
		code: GoogleAuthErrorCode,
		message: string,
		details?: Record<string, unknown>,
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = 'GoogleAuthError';
		this.code = code;
		this.details = details;
	}
}
