import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { campaigns } from '$lib/server/db/schema';
import { campaignFormSchema, type CampaignFormSubmission } from '$lib/validation/campaign';

type FieldErrors = Record<string, string[] | undefined>;

export type CampaignFormActionData = {
	values?: CampaignFormSubmission;
	errors?: FieldErrors;
	message?: string;
};

const getTrimmedField = (formData: FormData, key: string) =>
	formData.get(key)?.toString().trim() ?? '';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();

		const values: CampaignFormSubmission = {
			name: getTrimmedField(formData, 'name'),
			audience: getTrimmedField(formData, 'audience'),
			format: getTrimmedField(formData, 'format'),
			topic: getTrimmedField(formData, 'topic'),
			language: getTrimmedField(formData, 'language'),
			geography: getTrimmedField(formData, 'geography'),
			notes: formData.get('notes')?.toString().trim() ?? ''
		};

		const parseResult = campaignFormSchema.safeParse(values);

		if (!parseResult.success) {
			const { fieldErrors } = parseResult.error.flatten();
			return fail<CampaignFormActionData>(400, {
				errors: fieldErrors,
				values
			});
		}

		const campaignData = parseResult.data;

		const { data: userData } = await locals.supabase.auth.getUser();
		const createdBy = userData?.user?.id ?? null;

		try {
			await db.insert(campaigns).values({
				name: campaignData.name,
				audience: campaignData.audience,
				format: campaignData.format,
				topic: campaignData.topic,
				language: campaignData.language,
				geography: campaignData.geography,
				notes: campaignData.notes?.length ? campaignData.notes : null,
				status: 'draft',
				created_by: createdBy
			});
		} catch (error) {
			console.error('Failed to create campaign:', error);
			return fail<CampaignFormActionData>(500, {
				message: 'Unable to save the campaign right now. Please try again.',
				values
			});
		}

		throw redirect(303, '/campaigns');
	}
};
