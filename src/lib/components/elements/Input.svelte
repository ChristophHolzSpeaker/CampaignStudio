<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes & {
		label: string;
		error?: string;
	};

	let {
		label,
		error = $bindable(undefined),
		value = $bindable(''),
		id,
		...props
	}: Props = $props();
</script>

<div class="space-y-1">
	<label for={id} class="text-[0.6rem] text-[var(--text-muted)] uppercase">
		{label}
	</label>
	<input
		{id}
		{...props}
		bind:value
		class="w-full border-b-[2px] border-[color:var(--text-primary)]/30 bg-sky-50 p-3 font-light text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
		aria-invalid={Boolean(error)}
		autocomplete="off"
	/>
	{#if error}
		<p class="text-xs font-semibold text-[var(--accent)] uppercase">
			{error}
		</p>
	{/if}
</div>
