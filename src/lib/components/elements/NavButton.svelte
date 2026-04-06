<script lang="ts">
	type Props = {
		href: string;
		children?: any;
		variant?: 'default' | 'outline';
	};

	let { href, variant = 'default', children }: Props = $props();

	const variants = {
		default: 'btn-primary',
		outline: 'outline-link'
	};
</script>

<a {href} class="text-center {variants[variant]}">
	{@render children?.()}
</a>
