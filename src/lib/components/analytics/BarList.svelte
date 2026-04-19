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
	}

	h3 {
		margin: 0;
		font-size: 1rem;
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
		font-size: 0.78rem;
	}

	.value {
		font-size: 0.78rem;
		color: #5d3f3f;
	}

	.help,
	.empty {
		font-size: 0.72rem;
		color: #5d3f3f;
	}

	.track {
		height: 0.5rem;
		background: #f3f3f3;
	}

	.fill {
		height: 100%;
		background: linear-gradient(135deg, #b8002a, #e2183b);
	}
</style>
