import { db } from '$lib/server/db';
import { clients } from '$lib/server/db/schema';
import type { ClientFormInput } from '$lib/validation/clients';
import { asc, eq } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';

const CLIENT_LOGO_BUCKET = 'client-logos';
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/svg+xml', 'image/webp']);
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

function toSlug(value: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

	return slug || 'client';
}

function ensureLogoFile(file: File | null, required: boolean): File | null {
	if (!file || file.size === 0) {
		if (required) {
			throw new Error('A logo file is required.');
		}

		return null;
	}

	if (!ALLOWED_LOGO_TYPES.has(file.type)) {
		throw new Error('Logo must be a PNG, JPEG, or WEBP image.');
	}

	if (file.size > MAX_LOGO_SIZE_BYTES) {
		throw new Error('Logo file must be 5MB or smaller.');
	}

	return file;
}

async function uploadClientLogo(
	supabase: SupabaseClient,
	clientId: string,
	clientName: string,
	logoFile: File
): Promise<{ bucket: string; path: string; publicUrl: string }> {
	const originalName = logoFile.name || 'logo';
	const extension = originalName.includes('.')
		? originalName.split('.').pop()?.toLowerCase()
		: 'webp';
	const safeExtension = extension && extension.length <= 5 ? extension : 'webp';
	const fileName = `${Date.now()}-${toSlug(clientName)}.${safeExtension}`;
	const path = `clients/${clientId}/${fileName}`;

	const { error: uploadError } = await supabase.storage
		.from(CLIENT_LOGO_BUCKET)
		.upload(path, logoFile, {
			cacheControl: '3600',
			upsert: false,
			contentType: logoFile.type
		});

	if (uploadError) {
		throw new Error(`Unable to upload client logo: ${uploadError.message}`);
	}

	const publicUrl = supabase.storage.from(CLIENT_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;

	return {
		bucket: CLIENT_LOGO_BUCKET,
		path,
		publicUrl
	};
}

async function removeClientLogo(
	supabase: SupabaseClient,
	logoBucket: string | null,
	logoPath: string | null
): Promise<void> {
	if (!logoBucket || !logoPath) {
		return;
	}

	const { error } = await supabase.storage.from(logoBucket).remove([logoPath]);
	if (error) {
		console.warn('Unable to delete old client logo from storage', {
			logoBucket,
			logoPath,
			error: error.message
		});
	}
}

export async function listClients() {
	return db
		.select()
		.from(clients)
		.orderBy(asc(clients.priority), asc(clients.name), asc(clients.id));
}

export async function getClientById(id: string) {
	const [record] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
	return record ?? null;
}

export async function createClient(
	input: ClientFormInput,
	logoFile: File,
	supabase: SupabaseClient
): Promise<string> {
	const validatedLogo = ensureLogoFile(logoFile, true);
	if (!validatedLogo) {
		throw new Error('A logo file is required.');
	}

	const id = `client-${toSlug(input.name)}-${crypto.randomUUID().slice(0, 8)}`;
	const uploaded = await uploadClientLogo(supabase, id, input.name, validatedLogo);

	await db.insert(clients).values({
		id,
		name: input.name,
		logo_url: uploaded.publicUrl,
		logo_bucket: uploaded.bucket,
		logo_path: uploaded.path,
		logo_alt: input.logoAlt,
		industry: input.industry,
		keynote_case_study: input.keynoteCaseStudy,
		audiences: input.audiences,
		topics: input.topics,
		formats: input.formats,
		geographies: input.geographies,
		intent_tags: input.intentTags,
		priority: input.priority
	});

	return id;
}

export async function updateClient(
	id: string,
	input: ClientFormInput,
	logoFile: File | null,
	supabase: SupabaseClient
): Promise<void> {
	const existing = await getClientById(id);
	if (!existing) {
		throw new Error('Client not found.');
	}

	const nextLogo = ensureLogoFile(logoFile, false);
	let logoUrl = existing.logo_url;
	let logoBucket = existing.logo_bucket;
	let logoPath = existing.logo_path;

	if (nextLogo) {
		const uploaded = await uploadClientLogo(supabase, id, input.name, nextLogo);
		logoUrl = uploaded.publicUrl;
		logoBucket = uploaded.bucket;
		logoPath = uploaded.path;
	}

	await db
		.update(clients)
		.set({
			name: input.name,
			logo_url: logoUrl,
			logo_bucket: logoBucket,
			logo_path: logoPath,
			logo_alt: input.logoAlt,
			industry: input.industry,
			keynote_case_study: input.keynoteCaseStudy,
			audiences: input.audiences,
			topics: input.topics,
			formats: input.formats,
			geographies: input.geographies,
			intent_tags: input.intentTags,
			priority: input.priority,
			updated_at: new Date()
		})
		.where(eq(clients.id, id));

	if (nextLogo) {
		await removeClientLogo(supabase, existing.logo_bucket, existing.logo_path);
	}
}

export async function toggleClientActive(id: string, active: boolean): Promise<void> {
	await db
		.update(clients)
		.set({ is_active: active, updated_at: new Date() })
		.where(eq(clients.id, id));
}

export async function deleteClient(id: string, supabase: SupabaseClient): Promise<void> {
	const existing = await getClientById(id);
	if (!existing) {
		return;
	}

	await db.delete(clients).where(eq(clients.id, id));
	await removeClientLogo(supabase, existing.logo_bucket, existing.logo_path);
}
