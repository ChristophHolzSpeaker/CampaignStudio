import { db } from '$lib/server/db';
import { keynotes } from '$lib/server/db/schema';
import type { KeynoteFormInput } from '$lib/validation/keynotes';
import { asc, eq } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';

const KEYNOTE_IMAGE_BUCKET = 'keynote-images';
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function toSlug(value: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

	return slug || 'keynote';
}

function ensureImageFile(file: File | null, required: boolean): File | null {
	if (!file || file.size === 0) {
		if (required) {
			throw new Error('A keynote image file is required.');
		}

		return null;
	}

	if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
		throw new Error('Image must be a PNG, JPEG, or WEBP file.');
	}

	if (file.size > MAX_IMAGE_SIZE_BYTES) {
		throw new Error('Image file must be 5MB or smaller.');
	}

	return file;
}

async function uploadKeynoteImage(
	supabase: SupabaseClient,
	keynoteId: string,
	keynoteTitle: string,
	imageFile: File
): Promise<{ bucket: string; path: string; publicUrl: string }> {
	const originalName = imageFile.name || 'image';
	const extension = originalName.includes('.')
		? originalName.split('.').pop()?.toLowerCase()
		: 'webp';
	const safeExtension = extension && extension.length <= 5 ? extension : 'webp';
	const fileName = `${Date.now()}-${toSlug(keynoteTitle)}.${safeExtension}`;
	const path = `keynotes/${keynoteId}/${fileName}`;

	const { error: uploadError } = await supabase.storage
		.from(KEYNOTE_IMAGE_BUCKET)
		.upload(path, imageFile, {
			cacheControl: '3600',
			upsert: false,
			contentType: imageFile.type
		});

	if (uploadError) {
		throw new Error(`Unable to upload keynote image: ${uploadError.message}`);
	}

	const publicUrl = supabase.storage.from(KEYNOTE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;

	return {
		bucket: KEYNOTE_IMAGE_BUCKET,
		path,
		publicUrl
	};
}

async function removeKeynoteImage(
	supabase: SupabaseClient,
	imageBucket: string | null,
	imagePath: string | null
): Promise<void> {
	if (!imageBucket || !imagePath) {
		return;
	}

	const { error } = await supabase.storage.from(imageBucket).remove([imagePath]);
	if (error) {
		console.warn('Unable to delete old keynote image from storage', {
			imageBucket,
			imagePath,
			error: error.message
		});
	}
}

export async function listKeynotes() {
	return db
		.select()
		.from(keynotes)
		.orderBy(asc(keynotes.priority), asc(keynotes.keynote_title), asc(keynotes.id));
}

export async function getKeynoteById(id: string) {
	const [record] = await db.select().from(keynotes).where(eq(keynotes.id, id)).limit(1);
	return record ?? null;
}

export async function createKeynote(
	input: KeynoteFormInput,
	imageFile: File,
	supabase: SupabaseClient
): Promise<string> {
	const validatedImage = ensureImageFile(imageFile, true);
	if (!validatedImage) {
		throw new Error('A keynote image file is required.');
	}

	const id = `keynote-${toSlug(input.keynoteTitle)}-${crypto.randomUUID().slice(0, 8)}`;
	const uploaded = await uploadKeynoteImage(supabase, id, input.keynoteTitle, validatedImage);

	await db.insert(keynotes).values({
		id,
		keynote_title: input.keynoteTitle,
		keynote_summary: input.keynoteSummary,
		image_url: uploaded.publicUrl,
		image_bucket: uploaded.bucket,
		image_path: uploaded.path,
		image_alt: input.imageAlt,
		audiences: input.audiences,
		topics: input.topics,
		formats: input.formats,
		geographies: input.geographies,
		intent_tags: input.intentTags,
		priority: input.priority
	});

	return id;
}

export async function updateKeynote(
	id: string,
	input: KeynoteFormInput,
	imageFile: File | null,
	supabase: SupabaseClient
): Promise<void> {
	const existing = await getKeynoteById(id);
	if (!existing) {
		throw new Error('Keynote not found.');
	}

	const nextImage = ensureImageFile(imageFile, false);
	let imageUrl = existing.image_url;
	let imageBucket = existing.image_bucket;
	let imagePath = existing.image_path;

	if (nextImage) {
		const uploaded = await uploadKeynoteImage(supabase, id, input.keynoteTitle, nextImage);
		imageUrl = uploaded.publicUrl;
		imageBucket = uploaded.bucket;
		imagePath = uploaded.path;
	}

	await db
		.update(keynotes)
		.set({
			keynote_title: input.keynoteTitle,
			keynote_summary: input.keynoteSummary,
			image_url: imageUrl,
			image_bucket: imageBucket,
			image_path: imagePath,
			image_alt: input.imageAlt,
			audiences: input.audiences,
			topics: input.topics,
			formats: input.formats,
			geographies: input.geographies,
			intent_tags: input.intentTags,
			priority: input.priority,
			updated_at: new Date()
		})
		.where(eq(keynotes.id, id));

	if (nextImage) {
		await removeKeynoteImage(supabase, existing.image_bucket, existing.image_path);
	}
}

export async function toggleKeynoteActive(id: string, active: boolean): Promise<void> {
	await db
		.update(keynotes)
		.set({ is_active: active, updated_at: new Date() })
		.where(eq(keynotes.id, id));
}

export async function deleteKeynote(id: string, supabase: SupabaseClient): Promise<void> {
	const existing = await getKeynoteById(id);
	if (!existing) {
		return;
	}

	await db.delete(keynotes).where(eq(keynotes.id, id));
	await removeKeynoteImage(supabase, existing.image_bucket, existing.image_path);
}
