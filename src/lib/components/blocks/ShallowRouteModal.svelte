<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		onclose: () => void;
		title?: string;
		children?: Snippet;
	};

	let { onclose, title = 'Dialog', children }: Props = $props();

	const titleId = $props.id();

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-surface/70 px-4 py-8 backdrop-blur-sm"
	role="presentation"
	onclick={handleBackdropClick}
>
	<div
		class="bg-surface-container w-full max-w-4xl overflow-hidden text-on-surface shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
	>
		<div class="border-outline/20 flex items-center justify-between border-b px-4 py-3 sm:px-6">
			<h2 id={titleId} class="text-base font-semibold sm:text-lg">{title}</h2>
			<button
				type="button"
				class="hover:bg-surface-container-high inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface/70 transition hover:text-on-surface"
				onclick={onclose}
				aria-label="Close dialog"
			>
				<span aria-hidden="true">✕</span>
			</button>
		</div>
		<div class="p-4 sm:p-6">
			{@render children?.()}
		</div>
	</div>
</div>
