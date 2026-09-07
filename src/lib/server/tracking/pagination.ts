import { z } from 'zod';
const schema = z.object({ at: z.iso.datetime(), id: z.uuid() });
export function decodeCursor(raw: string | null) {
	if (!raw) return null;
	try {
		return schema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
	} catch {
		throw new Error('Invalid cursor');
	}
}
export function nextCursor(rows: Array<{ id: string; occurred_at: Date }>, limit: number) {
	const last = rows.at(-1);
	return rows.length === limit && last
		? Buffer.from(JSON.stringify({ at: last.occurred_at.toISOString(), id: last.id })).toString(
				'base64url'
			)
		: null;
}
