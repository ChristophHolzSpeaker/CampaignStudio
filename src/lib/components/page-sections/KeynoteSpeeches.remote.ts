import { query } from '$app/server';
import { db } from '$lib/server/db';
import { keynotes } from '$lib/server/db/schema';
import { asc, and, eq, notInArray } from 'drizzle-orm';
import { z } from 'zod';

const keynoteIdsSchema = z.object({
	keynoteIds: z.array(z.string().trim().min(1)).min(3)
});

type KeynoteCard = {
	id: string;
	title: string;
	imageUrl: string;
	summary: string;
};

export const getAdditionalKeynotes = query(keynoteIdsSchema, async ({ keynoteIds }) => {
	const uniqueKeynoteIds = [...new Set(keynoteIds)];

	const rows = await db
		.select({
			id: keynotes.id,
			title: keynotes.keynote_title,
			imageUrl: keynotes.image_url,
			summary: keynotes.keynote_short
		})
		.from(keynotes)
		.where(and(eq(keynotes.status, 'active'), notInArray(keynotes.id, uniqueKeynoteIds)))
		.orderBy(asc(keynotes.keynote_title), asc(keynotes.id))
		.limit(3);

	return rows.map(
		(keynote): KeynoteCard => ({
			...keynote,
			summary: keynote.summary ?? ''
		})
	);
});
