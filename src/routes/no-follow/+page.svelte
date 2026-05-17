<script lang="ts">
	import BookletDownloadCta from '$lib/components/page-sections/BookletDownloadCta.svelte';
	import HeroLargeEmailCta from '$lib/components/page-sections/HeroLargeEmailCta.svelte';
	import SpeakerInAction from '$lib/components/page-sections/SpeakerInAction.svelte';
	import YoutubeGrid from '$lib/components/page-sections/YoutubeGrid.svelte';
</script>

<HeroLargeEmailCta
	props={{
		heading: 'Ignite the stage',
		labelText: 'Ready for transformation?'
	}}
></HeroLargeEmailCta>
<YoutubeGrid
	props={{
		videos: [
			{ url: 'https://youtu.be/2tyK-fIgqOc?si=JAl0i4CFBPeRRTch' },
			{ url: 'https://youtu.be/2tyK-fIgqOc?si=JAl0i4CFBPeRRTch' },
			{ url: 'https://youtu.be/2tyK-fIgqOc?si=JAl0i4CFBPeRRTch' }
		]
	}}
></YoutubeGrid>
<BookletDownloadCta
	props={{
		labelText: 'Free resource',
		heading: 'Meet Christoph in booklet form',
		buttonCtaText: 'Download the booklet',
		paragraph:
			'Get a quick introduction to Christoph’s world of transformation, AI, aviation, robotics, and science — packed into a short booklet you can read, share, or forward to your team. No form. No email required. Just download and enjoy.'
	}}
></BookletDownloadCta>
<SpeakerInAction></SpeakerInAction>
