import { db } from '$lib/server/db';
import { logos } from '$lib/server/db/schema';
import type { LogoFormInput } from '$lib/validation/logos';
import { asc, eq } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';

const LOGO_BUCKET = 'client-logos';
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/svg+xml', 'image/webp']);
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

function toSlug(value: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

	return slug || 'logo';
}

function ensureLogoFile(file: File | null, required: boolean): File | null {
	if (!file || file.size === 0) {
		if (required) {
			throw new Error('A logo file is required.');
		}

		return null;
	}

	if (!ALLOWED_LOGO_TYPES.has(file.type)) {
		throw new Error('Logo must be a PNG, SVG, or WEBP image.');
	}

	if (file.size > MAX_LOGO_SIZE_BYTES) {
		throw new Error('Logo file must be 5MB or smaller.');
	}

	return file;
}

async function uploadLogo(
	supabase: SupabaseClient,
	logoId: string,
	logoName: string,
	logoFile: File
): Promise<{ bucket: string; path: string; publicUrl: string }> {
	const originalName = logoFile.name || 'logo';
	const extension = originalName.includes('.')
		? originalName.split('.').pop()?.toLowerCase()
		: 'webp';
	const safeExtension = extension && extension.length <= 5 ? extension : 'webp';
	const fileName = `${Date.now()}-${toSlug(logoName)}.${safeExtension}`;
	const path = `logos/${logoId}/${fileName}`;

	const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, logoFile, {
		cacheControl: '3600',
		upsert: false,
		contentType: logoFile.type
	});

	if (uploadError) {
		throw new Error(`Unable to upload logo: ${uploadError.message}`);
	}

	const publicUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;

	return {
		bucket: LOGO_BUCKET,
		path,
		publicUrl
	};
}

async function removeLogo(
	supabase: SupabaseClient,
	logoBucket: string | null,
	logoPath: string | null
): Promise<void> {
	if (!logoBucket || !logoPath) {
		return;
	}

	const { error } = await supabase.storage.from(logoBucket).remove([logoPath]);
	if (error) {
		console.warn('Unable to delete old logo from storage', {
			logoBucket,
			logoPath,
			error: error.message
		});
	}
}

export async function listLogos() {
	return db.select().from(logos).orderBy(asc(logos.priority), asc(logos.name), asc(logos.id));
}

export async function getLogoById(id: string) {
	const [record] = await db.select().from(logos).where(eq(logos.id, id)).limit(1);
	return record ?? null;
}

export async function createLogo(
	input: LogoFormInput,
	logoFile: File,
	supabase: SupabaseClient
): Promise<string> {
	const validatedLogo = ensureLogoFile(logoFile, true);
	if (!validatedLogo) {
		throw new Error('A logo file is required.');
	}

	const id = `logo-${toSlug(input.name)}-${crypto.randomUUID().slice(0, 8)}`;
	const uploaded = await uploadLogo(supabase, id, input.name, validatedLogo);

	await db.insert(logos).values({
		id,
		name: input.name,
		logo_url: uploaded.publicUrl,
		logo_bucket: uploaded.bucket,
		logo_path: uploaded.path,
		logo_alt: input.logoAlt,
		priority: input.priority
	});

	return id;
}

export async function updateLogo(
	id: string,
	input: LogoFormInput,
	logoFile: File | null,
	supabase: SupabaseClient
): Promise<void> {
	const existing = await getLogoById(id);
	if (!existing) {
		throw new Error('Logo not found.');
	}

	const nextLogo = ensureLogoFile(logoFile, false);
	let logoUrl = existing.logo_url;
	let logoBucket = existing.logo_bucket;
	let logoPath = existing.logo_path;

	if (nextLogo) {
		const uploaded = await uploadLogo(supabase, id, input.name, nextLogo);
		logoUrl = uploaded.publicUrl;
		logoBucket = uploaded.bucket;
		logoPath = uploaded.path;
	}

	await db
		.update(logos)
		.set({
			name: input.name,
			logo_url: logoUrl,
			logo_bucket: logoBucket,
			logo_path: logoPath,
			logo_alt: input.logoAlt,
			priority: input.priority,
			updated_at: new Date()
		})
		.where(eq(logos.id, id));

	if (nextLogo) {
		await removeLogo(supabase, existing.logo_bucket, existing.logo_path);
	}
}

export async function toggleLogoActive(id: string, active: boolean): Promise<void> {
	await db.update(logos).set({ is_active: active, updated_at: new Date() }).where(eq(logos.id, id));
}

export async function deleteLogo(id: string, supabase: SupabaseClient): Promise<void> {
	const existing = await getLogoById(id);
	if (!existing) {
		return;
	}

	await db.delete(logos).where(eq(logos.id, id));
	await removeLogo(supabase, existing.logo_bucket, existing.logo_path);
}
