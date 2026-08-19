import { error } from '@sveltejs/kit';
import {
	getArtifactPageById,
	getPublishedArtifactPageById
} from '$lib/server/artifacts/repository';
import { verifyBookingWidgetToken } from '$lib/server/artifacts/widget-token';
import { resolvePublicBookingSlotPreview } from '$lib/server/bookings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const claims = verifyBookingWidgetToken(url.searchParams.get('context'));
	if (!claims) throw error(404, 'Booking widget not found');
	const page = claims.preview
		? await getArtifactPageById(claims.campaignPageId)
		: await getPublishedArtifactPageById(claims.campaignPageId);
	if (!page || page.campaignId !== claims.campaignId || page.versionNumber !== claims.versionNumber)
		throw error(404, 'Booking widget not found');
	setHeaders({
		'Cache-Control': 'private, no-store',
		'X-Robots-Tag': 'noindex, nofollow'
	});
	const slots = await resolvePublicBookingSlotPreview({ bookingType: 'lead' });
	return {
		campaignId: page.campaignId,
		campaignPageId: page.campaignPageId,
		slug: page.slug,
		slotGroups: slots.slotGroups,
		preview: claims.preview
	};
};
