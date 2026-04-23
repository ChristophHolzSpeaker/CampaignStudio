<script lang="ts">
	type Props = {
		isSubmitting?: undefined | boolean;
		children?: any;
		variant?: 'primary' | 'secondary' | 'dark' | 'outline';
	};

	let { children, isSubmitting = false, variant = 'primary' }: Props = $props();

	const variants = {
		primary: 'btn-primary',
		dark: 'btn-dark',
		secondary: 'btn-secondary',
		outline: 'btn-outline'
	};
</script>

<button
	type="submit"
	class="{variants[variant]} inline-flex items-center gap-2"
	disabled={isSubmitting}
>
	{#if isSubmitting}
		<span class="proicons--spinner animate-spin"></span> Please wait...
	{:else}
		{@render children?.()}
	{/if}
</button>

<style>
	.proicons--spinner {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='%23000' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M12 21.25A9.25 9.25 0 1 0 2.75 12'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
