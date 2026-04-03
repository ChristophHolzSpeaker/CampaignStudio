<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type Props = HTMLSelectAttributes & {
		label: string;
		options: readonly string[];
		error?: string;
		placeholder?: string;
	};

	let {
		label,
		options,
		placeholder,
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
	<div class="relative">
		<select
			{id}
			{...props}
			bind:value
			class="w-full border-b-[2px] border-[color:var(--text-primary)]/30 bg-transparent pb-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
			aria-invalid={Boolean(error)}
		>
			{#if placeholder}
				<option value="" disabled>{placeholder}</option>
			{/if}
			{#each options as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
		<span class="pointer-events-none absolute top-3 right-0 text-sm text-[var(--text-muted)]">
			⌄
		</span>
	</div>
	{#if error}
		<p class="text-xs font-semibold text-[var(--accent)] uppercase">
			{error}
		</p>
	{/if}
</div>
