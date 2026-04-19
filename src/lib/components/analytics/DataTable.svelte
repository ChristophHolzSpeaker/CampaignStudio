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
		color: #5d3f3f;
	}

	.table-shell {
		overflow-x: auto;
		background: #ffffff;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 680px;
	}

	th,
	td {
		padding: 0.6rem 0.75rem;
		font-size: 0.78rem;
		text-align: left;
		vertical-align: top;
	}

	th {
		font-size: 0.66rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #5d3f3f;
		background: #f3f3f3;
	}

	tbody tr:nth-child(even) {
		background: #fafafa;
	}

	.align-right {
		text-align: right;
	}
</style>
