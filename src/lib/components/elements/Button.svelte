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

<button type="submit" class={variants[variant]} disabled={isSubmitting}>
	{@render children?.()}
</button>
