<script lang="ts">
	type Props = {
		href: string;
		children?: any;
		variant?: 'default' | 'outline';
		onclick?: (event: MouseEvent) => void;
	};

	let { href, variant = 'default', children, onclick }: Props = $props();

	const variants = {
		default: 'btn-primary',
		outline: 'outline-link'
	};
</script>

<a {href} {onclick} class="text-center {variants[variant]}">
	{@render children?.()}
</a>
