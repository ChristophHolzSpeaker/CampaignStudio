<script lang="ts">
	type BarItem = {
		id: string;
		label: string;
		value: number;
		helpText?: string;
	};

	type Props = {
		title: string;
		items: readonly BarItem[];
		emptyLabel?: string;
	};

	let { title, items, emptyLabel = 'No rows available' }: Props = $props();

	const maxValue = $derived.by(() => {
		if (items.length === 0) {
			return 1;
		}

		return Math.max(1, ...items.map((item) => item.value));
	});

	const widthPercent = (value: number): number => (value / maxValue) * 100;
</script>

<section class="bar-list">
	<h3>{title}</h3>
	{#if items.length === 0}
		<p class="empty">{emptyLabel}</p>
	{:else}
		<ul>
			{#each items as item (item.id)}
				<li>
					<div class="labels">
						<p class="label">{item.label}</p>
						<p class="value">{item.value}</p>
					</div>
					<div class="track">
						<div class="fill" style:width={`${Math.max(4, widthPercent(item.value))}%`}></div>
					</div>
					{#if item.helpText}
						<p class="help">{item.helpText}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.bar-list {
		background: #ffffff;
		padding: 1rem;
		display: grid;
		gap: 0.9rem;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
		font-family: var(
			--analytics-font,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif
		);
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 650;
		color: #111827;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}

	li {
		display: grid;
		gap: 0.35rem;
	}

	.labels {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.label,
	.value,
	.help,
	.empty {
		margin: 0;
	}

	.label {
		font-size: 0.82rem;
		color: #111827;
	}

	.value {
		font-size: 0.82rem;
		color: #6b7280;
		font-variant-numeric: tabular-nums;
	}

	.help,
	.empty {
		font-size: 0.72rem;
		color: #6b7280;
	}

	.track {
		height: 0.5rem;
		background: #f3f4f6;
		border-radius: 999px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: linear-gradient(135deg, #2563eb, #60a5fa);
		border-radius: inherit;
	}
</style>
