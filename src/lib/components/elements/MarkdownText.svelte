<script lang="ts">
	import { parseMarkdown } from '$lib/utils/markdown';

	type Props = {
		content: string;
	};

	let { content }: Props = $props();
	const blocks = $derived(parseMarkdown(content));
</script>

{#if blocks.length > 0}
	<div class="markdown-flow">
		{#each blocks as block, blockIndex (`${block.type}-${blockIndex}`)}
			{#if block.type === 'heading'}
				{#if block.level === 1}
					<h2 class="markdown-heading markdown-heading-lg">
						{#each block.tokens as token, tokenIndex (`heading-${blockIndex}-${tokenIndex}`)}
							{#if token.type === 'text'}
								{token.text}
							{:else if token.type === 'strong'}
								<strong>{token.text}</strong>
							{:else if token.type === 'em'}
								<em>{token.text}</em>
							{:else if token.type === 'code'}
								<code>{token.text}</code>
							{:else if token.type === 'link'}
								<a href={token.href} target="_blank" rel="noreferrer noopener">{token.text}</a>
							{/if}
						{/each}
					</h2>
				{:else if block.level === 2}
					<h3 class="markdown-heading markdown-heading-md">
						{#each block.tokens as token, tokenIndex (`heading-${blockIndex}-${tokenIndex}`)}
							{#if token.type === 'text'}
								{token.text}
							{:else if token.type === 'strong'}
								<strong>{token.text}</strong>
							{:else if token.type === 'em'}
								<em>{token.text}</em>
							{:else if token.type === 'code'}
								<code>{token.text}</code>
							{:else if token.type === 'link'}
								<a href={token.href} target="_blank" rel="noreferrer noopener">{token.text}</a>
							{/if}
						{/each}
					</h3>
				{:else}
					<h4 class="markdown-heading markdown-heading-sm">
						{#each block.tokens as token, tokenIndex (`heading-${blockIndex}-${tokenIndex}`)}
							{#if token.type === 'text'}
								{token.text}
							{:else if token.type === 'strong'}
								<strong>{token.text}</strong>
							{:else if token.type === 'em'}
								<em>{token.text}</em>
							{:else if token.type === 'code'}
								<code>{token.text}</code>
							{:else if token.type === 'link'}
								<a href={token.href} target="_blank" rel="noreferrer noopener">{token.text}</a>
							{/if}
						{/each}
					</h4>
				{/if}
			{:else if block.type === 'paragraph'}
				<p class="markdown-paragraph">
					{#each block.tokens as token, tokenIndex (`paragraph-${blockIndex}-${tokenIndex}`)}
						{#if token.type === 'text'}
							{token.text}
						{:else if token.type === 'strong'}
							<strong>{token.text}</strong>
						{:else if token.type === 'em'}
							<em>{token.text}</em>
						{:else if token.type === 'code'}
							<code>{token.text}</code>
						{:else if token.type === 'link'}
							<a href={token.href} target="_blank" rel="noreferrer noopener">{token.text}</a>
						{/if}
					{/each}
				</p>
			{:else if block.type === 'ul'}
				<ul class="markdown-list">
					{#each block.items as item, itemIndex (`ul-item-${blockIndex}-${itemIndex}`)}
						<li>
							{#each item as token, tokenIndex (`ul-token-${blockIndex}-${itemIndex}-${tokenIndex}`)}
								{#if token.type === 'text'}
									{token.text}
								{:else if token.type === 'strong'}
									<strong>{token.text}</strong>
								{:else if token.type === 'em'}
									<em>{token.text}</em>
								{:else if token.type === 'code'}
									<code>{token.text}</code>
								{:else if token.type === 'link'}
									<a href={token.href} target="_blank" rel="noreferrer noopener">{token.text}</a>
								{/if}
							{/each}
						</li>
					{/each}
				</ul>
			{:else if block.type === 'ol'}
				<ol class="markdown-list markdown-ordered-list">
					{#each block.items as item, itemIndex (`ol-item-${blockIndex}-${itemIndex}`)}
						<li>
							{#each item as token, tokenIndex (`ol-token-${blockIndex}-${itemIndex}-${tokenIndex}`)}
								{#if token.type === 'text'}
									{token.text}
								{:else if token.type === 'strong'}
									<strong>{token.text}</strong>
								{:else if token.type === 'em'}
									<em>{token.text}</em>
								{:else if token.type === 'code'}
									<code>{token.text}</code>
								{:else if token.type === 'link'}
									<a href={token.href} target="_blank" rel="noreferrer noopener">{token.text}</a>
								{/if}
							{/each}
						</li>
					{/each}
				</ol>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.markdown-flow {
		display: grid;
		gap: 0.85rem;
	}

	.markdown-heading {
		font-family: 'Bureau Grot Compressed', 'Space Grotesk', sans-serif;
		font-weight: 500;
		letter-spacing: 0.02em;
		line-height: 1.15;
		text-transform: uppercase;
		margin: 0;
	}

	.markdown-heading-lg {
		font-size: 1.05rem;
	}

	.markdown-heading-md {
		font-size: 0.95rem;
	}

	.markdown-heading-sm {
		font-size: 0.85rem;
	}

	.markdown-paragraph {
		margin: 0;
		line-height: 1.65;
	}

	.markdown-list {
		margin: 0;
		padding-left: 1.05rem;
		display: grid;
		gap: 0.35rem;
		line-height: 1.65;
	}

	.markdown-ordered-list {
		list-style: decimal;
	}

	.markdown-list:not(.markdown-ordered-list) {
		list-style: disc;
	}

	strong {
		font-weight: 600;
	}

	em {
		font-style: italic;
	}

	code {
		font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 0.85em;
		background: rgba(var(--accent-rgb), 0.1);
		padding: 0.08rem 0.3rem;
	}

	a {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 0.16rem;
	}

	a:hover {
		text-decoration-thickness: 2px;
	}
</style>
