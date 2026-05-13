<script lang="ts">
	import { page } from '$app/state';

	type SectionIdentifierProps = {
		id: string;
	};
	let { props }: { props: SectionIdentifierProps } = $props();
</script>

{#if page.route.id?.startsWith('/(app)')}
	<div
		aria-hidden="true"
		class="absolute top-4 right-auto bottom-auto left-4 z-50 rounded border border-emerald-400 bg-emerald-50 p-2 text-sm text-emerald-500"
	>
		{props?.id ?? 'No id specified'}
	</div>
{/if}
