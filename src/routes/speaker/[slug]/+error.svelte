<script lang="ts">
	import { page } from '$app/state';

	const title = $derived(
		page.status === 404
			? 'Page Not Found'
			: page.status === 500
				? 'Something Went Wrong'
				: 'Something Went Wrong'
	);

	const message = $derived(
		page.status === 404
			? 'This speaker page may be unpublished or temporarily unavailable.'
			: 'Please try again in a moment.'
	);
</script>

<section class="px-6 py-24 sm:px-8 lg:px-12" aria-label="Error message">
	<div class="mx-auto max-w-3xl space-y-3">
		<p class="text-xs tracking-[0.12em] text-on-surface/60 uppercase">Error {page.status}</p>
		<h1 class="text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-5xl">
			{title}
		</h1>
		<p class="text-base leading-relaxed text-on-surface/75">{message}</p>
	</div>
</section>
