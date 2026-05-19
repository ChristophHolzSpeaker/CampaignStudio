<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	interface Props extends HTMLAnchorAttributes {
		href: string;
		children?: any;
		variant?: 'default' | 'outline';
		onclick?: (event: MouseEvent) => void;
	}
	let { href, variant = 'default', children, onclick, ...restProps }: Props = $props();

	const variants = {
		default: 'btn-primary',
		outline: 'outline-link'
	};
</script>

<a {href} {onclick} class="btn text-center {variants[variant]}" {...restProps}>
	{@render children?.()}
</a>
