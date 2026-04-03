<script lang="ts">
	type Props = {
		href: string;
		children?: any;
		variant?: 'default' | 'outline';
	};

	let { href, variant = 'default', children }: Props = $props();

	const variants = {
		default:
			'inline-flex items-center justify-center rounded-none bg-gradient-to-br from-[var(--accent)] via-[var(--accent-mid)] to-[var(--accent-strong)] px-6 py-3 text-lg font-semibold text-white uppercase transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70',
		outline: 'outline-link'
	};
</script>

<a {href} class={variants[variant]}>
	{@render children?.()}
</a>
