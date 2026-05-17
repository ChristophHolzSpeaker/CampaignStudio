<script lang="ts">
	import YouTubeEmbed from '../blocks/YouTubeEmbed.svelte';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	type YoutubeEmbedProps = {
		url: string;
	};
	interface YoutubeGridProps {
		videos: YoutubeEmbedProps[];
	}

	let { props }: { props: YoutubeGridProps } = $props();
</script>

<section
	class="relative isolate overflow-hidden bg-surface bg-surface-container-low px-6 py-16 sm:px-8 lg:px-12 lg:py-24"
>
	<SectionIdentifier props={{ id: 'youtube_grid' }}></SectionIdentifier>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		{#if props?.videos.length}
			{#each props.videos as video, i}
				<YouTubeEmbed {...video} autoplay={false}></YouTubeEmbed>
			{/each}
		{/if}
	</div>
</section>
