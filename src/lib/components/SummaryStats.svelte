<script lang="ts">
	import type { LogEntry } from '$lib/logParser';
	import { getSummaryStats } from '$lib/logParser';
	import tippy from 'tippy.js';
	import 'tippy.js/dist/tippy.css';
	import { onMount } from 'svelte';

	export let entries: LogEntry[] = [];
	export let hasLoadedFile: boolean = false;

	$: stats = getSummaryStats(entries);

	let showAllOperations = false;
	let showAllFds = false;
	let showAllPaths = false;

	function tooltip(node: HTMLElement, options: { content: string }) {
		const instance = tippy(node, {
			content: options.content,
			placement: 'top',
			arrow: true,
			theme: 'light-border',
			maxWidth: 600,
			allowHTML: false,
			popperOptions: {
				modifiers: [
					{
						name: 'flip',
						options: {
							fallbackPlacements: ['bottom', 'right'],
						}
					}
				]
			}
		});

		return {
			update(newOptions: { content: string }) {
				instance.setContent(newOptions.content);
			},
			destroy() {
				instance.destroy();
			}
		};
	}
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
				<div class="section-header">
					<h3>Top Operations</h3>
					<button class="show-all-btn" on:click={() => showAllOperations = !showAllOperations}>
						{showAllOperations ? 'Show Top 10' : `Show All (${stats.uniqueOperations.toLocaleString()})`}
					</button>
				</div>
				{#each (showAllOperations ? stats.allOperationCounts : stats.operationCounts) as [op, count], i}
					<div class="stat-item">
						<span class="label">{i + 1}.</span>
						<span class="op-name">{op}</span>
						<span class="value">{count.toLocaleString()} ({((count / stats.totalEntries) * 100).toFixed(1)}%)</span>
					</div>
				{/each}
			</div>

			<div class="summary-section">
				<div class="section-header">
					<h3>Top File Descriptors</h3>
					<button class="show-all-btn" on:click={() => showAllFds = !showAllFds}>
						{showAllFds ? 'Show Top 10' : `Show All (${stats.uniqueFds.toLocaleString()})`}
					</button>
				</div>
				{#each (showAllFds ? stats.allFdCounts : stats.fdCounts) as [fd, count], i}
					<div class="stat-item">
						<span class="label">{i + 1}.</span>
						<span class="op-name">F={fd}</span>
						<span class="value">{count.toLocaleString()} ({((count / stats.totalEntries) * 100).toFixed(1)}%)</span>
					</div>
				{/each}
			</div>

			<div class="summary-section full-width">
				<div class="section-header">
					<h3>Top Accessed Paths</h3>
					<button class="show-all-btn" on:click={() => showAllPaths = !showAllPaths}>
						{showAllPaths ? 'Show Top 10' : `Show All (${stats.entriesWithPath.toLocaleString()})`}
					</button>
				</div>
				{#each (showAllPaths ? stats.allPathCounts : stats.pathCounts) as [path, count], i}
					<div class="stat-item path-row">
						<span class="label">{i + 1}.</span>
						<span class="value">{count.toLocaleString()} times</span>
						<span class="path" use:tooltip={{ content: path }}>
							{path.length > 80 ? path.slice(0, 80) + '...' : path}
						</span>
						<button 
							class="clipboard-btn"
							use:tooltip={{ content: 'Copy path to clipboard' }}
							on:click={() => {
								navigator.clipboard.writeText(path);
								alert('Path copied to clipboard!');
							}}
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="no-data">
		<p>{hasLoadedFile ? 'No entries match the current filters.' : 'No log entries to summarise. Please load a log file.'}</p>
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
		flex: 1;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #ddd;
	}

	.section-header h3 {
		margin: 0;
		padding: 0;
		border: none;
	}

	.show-all-btn {
		background: #4682b4;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.show-all-btn:hover {
		background: #5a92c4;
		transform: translateY(-1px);
	}

	.show-all-btn:active {
		transform: translateY(0);
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
		border-bottom: 1px solid #e9ecef;
		font-size: 0.9rem;
	}

	.stat-item.path-row {
		align-items: center;
	}

	.stat-item:last-child {
		border-bottom: none;
	}

	.label {
		color: #666;
		font-weight: 500;
		min-width: 2rem;
		text-align: right;
		margin-right: 1rem;
	}

	.value {
		color: #2c3e50;
		font-weight: 600;
	}

	.op-name {
		color: #555;
		flex: 1;
	}

	.path {
		color: #555;
		font-family: monospace;
		font-size: 0.85rem;
		margin-left: 0.5rem;
		flex: 1;
		text-align: right;
	}

	.clipboard-btn {
		background: transparent;
		border: none;
		border-radius: 4px;
		padding: 0.25rem;
		margin-left: 0.5rem;
		cursor: pointer;
		color: #666;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		width: 24px;
		height: 24px;
	}

	.path-row:hover .clipboard-btn {
		opacity: 1;
	}

	.clipboard-btn:hover {
		background: #f0f0f0;
		color: #4682b4;
	}

	.clipboard-btn:active {
		transform: scale(0.9);
	}

	.no-data {
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		color: #666;
	}

	:global(.tippy-box[data-theme~='light-border']) {
		background-color: white;
		color: #333;
		border: 1px solid #ddd;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
		font-size: 0.85rem;
		font-family: monospace;
		text-align: left;
	}

	:global(.tippy-box[data-theme~='light-border'][data-placement^='top'] > .tippy-arrow::before) {
		border-top-color: #ddd;
	}

	:global(.tippy-box[data-theme~='light-border'] > .tippy-arrow::after) {
		content: '';
		position: absolute;
		border-style: solid;
		border-color: transparent;
		border-width: 7px;
	}

	:global(.tippy-box[data-theme~='light-border'][data-placement^='top'] > .tippy-arrow::after) {
		border-top-color: white;
		top: -7px;
		left: -7px;
	}
</style>
