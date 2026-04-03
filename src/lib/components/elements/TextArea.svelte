<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = HTMLTextareaAttributes & {
		label: string;
		error?: string;
		helper?: string;
	};

	let {
		label,
		error = $bindable(undefined),
		value = $bindable(''),
		helper,
		id,
		rows = 4,
		...props
	}: Props = $props();
</script>

<div class="space-y-1">
	<label for={id} class="text-[0.6rem] text-[var(--text-muted)] uppercase">
		{label}
	</label>
	<textarea
		{id}
		{rows}
		{...props}
		bind:value
		class="w-full border-b-[2px] border-[color:var(--text-primary)]/30 bg-slate-100 pb-3 font-light text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
		aria-invalid={Boolean(error)}
	></textarea>
	{#if helper}
		<p class="text-[0.6rem] text-[var(--text-muted)] uppercase">{helper}</p>
	{/if}
	{#if error}
		<p class="text-xs font-semibold text-[var(--accent)] uppercase">
			{error}
		</p>
	{/if}
</div>
