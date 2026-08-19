import { ARTIFACT_MAX_FILE_BYTES } from '$lib/artifacts/contract';
import { uploadArtifactSessionFile } from '$lib/server/artifacts/repository';
import { publicApiJson, requirePublicApiWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, params }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;
	const declaredLength = Number(request.headers.get('content-length') ?? 0);
	if (declaredLength > ARTIFACT_MAX_FILE_BYTES)
		return publicApiJson({ ok: false, error: 'File exceeds the upload limit' }, guard.context, {
			status: 413
		});
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.byteLength > ARTIFACT_MAX_FILE_BYTES)
		return publicApiJson({ ok: false, error: 'File exceeds the upload limit' }, guard.context, {
			status: 413
		});
	try {
		const file = await uploadArtifactSessionFile({
			sessionId: params.id,
			path: params.path,
			mediaType:
				request.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream',
			bytes
		});
		return publicApiJson({ ok: true, data: file }, guard.context, { status: 201 });
	} catch (error) {
		return publicApiJson(
			{ ok: false, error: error instanceof Error ? error.message : 'File upload failed' },
			guard.context,
			{ status: 400 }
		);
	}
};
