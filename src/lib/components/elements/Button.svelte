<script lang="ts">
	type Props = {
		isSubmitting?: undefined | boolean;
		children?: any;
	};

	let { children, isSubmitting = false }: Props = $props();
</script>

<button
	type="submit"
	class="inline-flex items-center justify-center rounded-none bg-gradient-to-br from-[var(--accent)] via-[var(--accent-mid)] to-[var(--accent-strong)] px-6 py-3 text-lg font-semibold text-white uppercase transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
	disabled={isSubmitting}
>
	{@render children?.()}
</button>
