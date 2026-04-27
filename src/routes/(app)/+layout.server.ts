// src/routes/+layout.server.ts
import { db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

type CurrentUser = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
};

const getMetadataDisplayName = (metadata: unknown): string | null => {
	if (!metadata || typeof metadata !== 'object') return null;

	const values = metadata as Record<string, unknown>;
	const candidates = [values.display_name, values.full_name, values.name];

	for (const value of candidates) {
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim();
		}
	}

	return null;
};

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	let currentUser: CurrentUser | null = null;

	const {
		data: { user }
	} = await locals.supabase.auth.getUser();

	if (user) {
		const [profile] = await db
			.select({
				displayName: profiles.display_name,
				avatarBucket: profiles.avatar_bucket,
				avatarPath: profiles.avatar_path
			})
			.from(profiles)
			.where(eq(profiles.id, user.id))
			.limit(1);

		const displayName =
			profile?.displayName || getMetadataDisplayName(user.user_metadata) || user.email || user.id;

		const avatarUrl =
			profile?.avatarPath && profile.avatarBucket
				? locals.supabase.storage.from(profile.avatarBucket).getPublicUrl(profile.avatarPath).data
						.publicUrl
				: null;

		currentUser = {
			id: user.id,
			displayName,
			avatarUrl
		};
	}

	return {
		cookies: cookies.getAll(),
		currentUser
	};
};
