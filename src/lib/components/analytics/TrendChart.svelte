<script lang="ts">
	type TrendPoint = {
		label: string;
		visits: number;
		leads: number;
		bookings: number;
		inboundMessages?: number;
	};

	type Props = {
		data: readonly TrendPoint[];
		height?: number;
	};

	let { data, height = 220 }: Props = $props();

	const width = 900;
	const padding = 24;

	const maxValue = $derived.by(() => {
		if (data.length === 0) {
			return 1;
		}

		return Math.max(
			1,
			...data.flatMap((point) => [
				point.visits,
				point.leads,
				point.bookings,
				point.inboundMessages ?? 0
			])
		);
	});

	const toX = (index: number): number => {
		if (data.length <= 1) {
			return width / 2;
		}

		const innerWidth = width - padding * 2;
		return padding + (index / (data.length - 1)) * innerWidth;
	};

	const toY = (value: number): number => {
		const innerHeight = height - padding * 2;
		return height - padding - (value / maxValue) * innerHeight;
	};

	const toLine = (accessor: (point: TrendPoint) => number): string =>
		data.map((point, index) => `${toX(index)},${toY(accessor(point))}`).join(' ');

	const visitLine = $derived(toLine((point) => point.visits));
	const leadLine = $derived(toLine((point) => point.leads));
	const bookingLine = $derived(toLine((point) => point.bookings));
	const inboundLine = $derived(toLine((point) => point.inboundMessages ?? 0));
	const hasInboundSeries = $derived(data.some((point) => (point.inboundMessages ?? 0) > 0));
</script>

{#if data.length === 0}
	<p class="empty">No trend data in this date range.</p>
{:else}
	<div class="chart-shell">
		<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Funnel trend over time">
			<line x1={padding} y1={padding} x2={padding} y2={height - padding} class="axis" />
			<line
				x1={padding}
				y1={height - padding}
				x2={width - padding}
				y2={height - padding}
				class="axis"
			/>
			<polyline points={visitLine} class="line visits" />
			<polyline points={leadLine} class="line leads" />
			<polyline points={bookingLine} class="line bookings" />
			{#if hasInboundSeries}
				<polyline points={inboundLine} class="line inbound" />
			{/if}
		</svg>
		<div class="legend">
			<span><i class="swatch visits"></i>Visits</span>
			<span><i class="swatch leads"></i>Identified leads</span>
			<span><i class="swatch bookings"></i>Bookings completed</span>
			{#if hasInboundSeries}
				<span><i class="swatch inbound"></i>Inbound messages</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.empty {
		margin: 0;
		padding: 0.75rem;
		background: #ffffff;
		font-size: 0.85rem;
		color: #5d3f3f;
	}

	.chart-shell {
		background: #ffffff;
		padding: 0.75rem;
		display: grid;
		gap: 0.75rem;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
		background: #ffffff;
	}

	.axis {
		stroke: #e2e2e2;
		stroke-width: 1;
	}

	.line {
		fill: none;
		stroke-width: 3;
		stroke-linecap: square;
	}

	.visits {
		stroke: #1f2937;
	}

	.leads {
		stroke: #b8002a;
	}

	.bookings {
		stroke: #0ea5e9;
	}

	.inbound {
		stroke: #ea580c;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.swatch {
		display: inline-block;
		width: 0.85rem;
		height: 0.85rem;
	}

	.swatch.visits {
		background: #1f2937;
	}

	.swatch.leads {
		background: #b8002a;
	}

	.swatch.bookings {
		background: #0ea5e9;
	}

	.swatch.inbound {
		background: #ea580c;
	}
</style>
