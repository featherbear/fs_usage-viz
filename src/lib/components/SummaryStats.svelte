<script lang="ts">
	import type { LogEntry } from '$lib/logParser';
	import { getSummaryStats } from '$lib/logParser';

	export let entries: LogEntry[] = [];

	$: stats = getSummaryStats(entries);
</script>

{#if stats}
	<div class="summary-container">
		<h2>Log Summary</h2>
		
		<div class="summary-grid">
			<div class="summary-section">
				<h3>Overview</h3>
				<div class="stat-item">
					<span class="label">Total Entries:</span>
					<span class="value">{stats.totalEntries.toLocaleString()}</span>
				</div>
				<div class="stat-item">
					<span class="label">Time Range:</span>
					<span class="value">
						{stats.minTime.toLocaleTimeString()} - {stats.maxTime.toLocaleTimeString()}
					</span>
				</div>
				<div class="stat-item">
					<span class="label">Duration:</span>
					<span class="value">{stats.durationSeconds.toFixed(2)}s</span>
				</div>
				<div class="stat-item">
					<span class="label">Unique Operations:</span>
					<span class="value">{stats.uniqueOperations}</span>
				</div>
				<div class="stat-item">
					<span class="label">Unique File Descriptors:</span>
					<span class="value">{stats.uniqueFds}</span>
				</div>
			</div>

			<div class="summary-section">
				<h3>Duration Statistics (ms)</h3>
				<div class="stat-item">
					<span class="label">Min:</span>
					<span class="value">{stats.minDuration.toFixed(4)}</span>
				</div>
				<div class="stat-item">
					<span class="label">Max:</span>
					<span class="value">{stats.maxDuration.toFixed(4)}</span>
				</div>
				<div class="stat-item">
					<span class="label">Avg:</span>
					<span class="value">{stats.avgDuration.toFixed(4)}</span>
				</div>
			</div>

			<div class="summary-section">
				<h3>Top Operations</h3>
				{#each stats.operationCounts as [op, count], i}
					<div class="stat-item">
						<span class="label">{i + 1}. {op}:</span>
						<span class="value">{count} ({((count / stats.totalEntries) * 100).toFixed(1)}%)</span>
					</div>
				{/each}
			</div>

			<div class="summary-section">
				<h3>Top File Descriptors</h3>
				{#each stats.fdCounts as [fd, count], i}
					<div class="stat-item">
						<span class="label">{i + 1}. F={fd}:</span>
						<span class="value">{count} ({((count / stats.totalEntries) * 100).toFixed(1)}%)</span>
					</div>
				{/each}
			</div>

			<div class="summary-section full-width">
				<h3>Top Accessed Paths</h3>
				{#each stats.pathCounts as [path, count], i}
					<div class="stat-item">
						<span class="label">{i + 1}.</span>
						<span class="value">{count}x</span>
						<span class="path">{path.length > 80 ? path.slice(0, 80) + '...' : path}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="no-data">
		<p>No log entries to summarize. Please load a log file.</p>
	</div>
{/if}

<style>
	.summary-container {
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		margin: 1rem 0;
	}

	h2 {
		margin: 0 0 1.5rem 0;
		color: #333;
		border-bottom: 2px solid #4682b4;
		padding-bottom: 0.5rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.summary-section {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 6px;
	}

	.summary-section.full-width {
		grid-column: 1 / -1;
	}

	h3 {
		margin: 0 0 1rem 0;
		color: #555;
		font-size: 1rem;
		font-weight: 600;
		border-bottom: 1px solid #ddd;
		padding-bottom: 0.5rem;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
		border-bottom: 1px solid #e9ecef;
		font-size: 0.9rem;
	}

	.stat-item:last-child {
		border-bottom: none;
	}

	.label {
		color: #666;
		font-weight: 500;
	}

	.value {
		color: #2c3e50;
		font-weight: 600;
	}

	.path {
		color: #555;
		font-family: monospace;
		font-size: 0.85rem;
		margin-left: 0.5rem;
		flex: 1;
		text-align: right;
		word-break: break-all;
	}

	.no-data {
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		color: #666;
	}
</style>
