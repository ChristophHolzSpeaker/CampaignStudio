<script lang="ts">
	type TableRow = {
		id: string;
		values: readonly string[];
	};

	type Props = {
		columns: readonly string[];
		rows: readonly TableRow[];
		emptyLabel?: string;
		rightAlignedColumns?: readonly number[];
	};

	let {
		columns,
		rows,
		emptyLabel = 'No rows to display',
		rightAlignedColumns = []
	}: Props = $props();

	const isRightAligned = (columnIndex: number): boolean =>
		rightAlignedColumns.includes(columnIndex);
</script>

{#if rows.length === 0}
	<p class="empty">{emptyLabel}</p>
{:else}
	<div class="table-shell">
		<table>
			<thead>
				<tr>
					{#each columns as column, columnIndex (`${column}-${columnIndex}`)}
						<th class:align-right={isRightAligned(columnIndex)}>{column}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr>
						{#each row.values as value, valueIndex (`${row.id}-${valueIndex}`)}
							<td class:align-right={isRightAligned(valueIndex)}>{value}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.empty {
		margin: 0;
		padding: 0.75rem;
		background: #ffffff;
		font-size: 0.85rem;
		color: #6b7280;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		font-family: var(
			--analytics-font,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif
		);
	}

	.table-shell {
		overflow-x: auto;
		background: #ffffff;
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

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 680px;
	}

	th,
	td {
		padding: 0.6rem 0.75rem;
		font-size: 0.8rem;
		text-align: left;
		vertical-align: top;
	}

	th {
		font-size: 0.68rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #6b7280;
		background: #f9fafb;
		font-weight: 600;
	}

	tbody tr:nth-child(even) {
		background: #fafafa;
	}

	.align-right {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
