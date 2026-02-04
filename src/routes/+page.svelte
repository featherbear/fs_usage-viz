<script lang="ts">
	export const prerender = true;
	import { parseLogFile, filterByFileDescriptor, filterByPath } from '$lib/logParser';
	import type { LogEntry } from '$lib/logParser';
	import OperationChart from '$lib/components/OperationChart.svelte';
	import DurationChart from '$lib/components/DurationChart.svelte';
	import OperationTypesChart from '$lib/components/OperationTypesChart.svelte';
	import SummaryStats from '$lib/components/SummaryStats.svelte';
	import FileDescriptorMap from '$lib/components/FileDescriptorMap.svelte';

	let allEntries: LogEntry[] = [];
	let filteredEntries: LogEntry[] = [];
	let fileInput: HTMLInputElement;
	let fileName: string = '';
	let isLoading: boolean = false;
	let loadingProgress: number = 0;
	
	// Filter states
	let fdFilter: string = '';
	let pathFilter: string = '';
	let binSize: number = 1.0;
	
	// Available file descriptors
	let availableFds: string[] = [];
	let filterTimeout: number | undefined;

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) return;
		
		isLoading = true;
		loadingProgress = 0;
		fileName = file.name;
		
		try {
			const content = await file.text();
			loadingProgress = 30;
			
			// Parse in chunks to avoid blocking
			await new Promise(resolve => setTimeout(resolve, 0));
			allEntries = parseLogFile(content);
			loadingProgress = 70;
			
			// Extract unique file descriptors
			const fdSet = new Set<string>();
			for (const entry of allEntries) {
				if (entry.fileDescriptor) {
					fdSet.add(entry.fileDescriptor);
				}
			}
			availableFds = Array.from(fdSet).sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
			
			filteredEntries = allEntries;
			loadingProgress = 100;
			resetFilters();
		} catch (error) {
			console.error('Error loading file:', error);
			alert('Error loading file. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	function applyFilters() {
		if (filterTimeout) {
			clearTimeout(filterTimeout);
		}
		
		filterTimeout = setTimeout(() => {
			filteredEntries = allEntries;
			
			if (fdFilter) {
				filteredEntries = filterByFileDescriptor(filteredEntries, fdFilter);
			}
			
			if (pathFilter.trim()) {
				filteredEntries = filterByPath(filteredEntries, pathFilter.trim(), false);
			}
		}, 300) as unknown as number;
	}

	function resetFilters() {
		fdFilter = '';
		pathFilter = '';
		binSize = 1.0;
		// Clear any pending filter timeout
		if (filterTimeout) {
			clearTimeout(filterTimeout);
			filterTimeout = undefined;
		}
		filteredEntries = allEntries;
	}

	$: if (fdFilter || pathFilter) {
		applyFilters();
	} else if (allEntries.length > 0 && (fdFilter === '' && pathFilter === '')) {
		filteredEntries = allEntries;
	}
</script>

<svelte:head>
	<title>fs_usage log visualiser</title>
</svelte:head>

<div class="container">
	<header>
		<h1>🔍 fs_usage log visualiser</h1>
		<p class="subtitle">Analyze macOS filesystem logs</p>
	</header>

	{#if isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<p class="loading-text">Processing {fileName}...</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {loadingProgress}%"></div>
			</div>
			<p class="progress-text">{loadingProgress}%</p>
		</div>
	{/if}

	<div class="upload-section">
		<input
			type="file"
			accept=".txt,.log"
			bind:this={fileInput}
			on:change={handleFileUpload}
			id="fileInput"
		/>
		<label for="fileInput" class="upload-button">
			📁 Select log file
		</label>
		
		{#if fileName}
			<span class="file-name">Loaded: {fileName}</span>
		{/if}
	</div>

	{#if allEntries.length > 0}
		<div class="filter-section">
			<h2>🔧 Filters & Settings</h2>
			
			<div class="filter-grid">
				<div class="filter-group">
					<label for="fdFilter">
						File Descriptor (F=)
						{#if fdFilter}
							<span class="filter-badge">{filteredEntries.length} entries</span>
						{/if}
					</label>
					<select id="fdFilter" bind:value={fdFilter}>
						<option value="">All File Descriptors</option>
						{#each availableFds as fd}
							<option value={fd}>F={fd}</option>
						{/each}
					</select>
				</div>

				<div class="filter-group">
					<label for="pathFilter">
						Path Filter (substring)
						{#if pathFilter}
							<span class="filter-badge">{filteredEntries.length} entries</span>
						{/if}
					</label>
					<input
						type="text"
						id="pathFilter"
						bind:value={pathFilter}
						placeholder="e.g. CrowdStrike, hbfw.log, /Library"
					/>
				</div>

				<div class="filter-group">
					<label for="binSize">
						Time Bin Size (seconds)
						<span class="hint">{binSize}s bins</span>
					</label>
					<input
						type="range"
						id="binSize"
						bind:value={binSize}
						min="0.1"
						max="10"
						step="0.1"
					/>
					<div class="range-labels">
						<span>0.1s</span>
						<span>5s</span>
						<span>10s</span>
					</div>
				</div>

				<div class="filter-group">
					<button on:click={resetFilters} class="reset-button">
						🔄 Reset Filters
					</button>
				</div>
			</div>
		</div>

		<SummaryStats entries={filteredEntries} hasLoadedFile={allEntries.length > 0} />

		<div class="charts-section">
			<h2>📊 Visualisations</h2>
			
			<OperationChart entries={filteredEntries} binSizeSeconds={binSize} />
			
			<div class="charts-row">
				<div class="chart-half">
					<OperationTypesChart entries={filteredEntries} />
				</div>
				<div class="chart-half">
					<DurationChart entries={filteredEntries} binSizeSeconds={binSize} />
				</div>
			</div>
			
			<div class="fd-map-section">
				<FileDescriptorMap entries={filteredEntries} />
			</div>
		</div>
	{:else}
		<div class="empty-state">
			<h2>👋 Welcome!</h2>
			<p>Upload a fs_usage log file to get started.</p>
			<p class="help-text">
				To generate a log file on Mac, run: <code>sudo fs_usage -w -f filesys > logs.txt</code>
			</p>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e8ba3 100%);
		min-height: 100vh;
	}

	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
		color: white;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0 0 0.5rem 0;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
	}

	.subtitle {
		font-size: 1.1rem;
		margin: 0;
		opacity: 0.9;
	}

	.upload-section {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	#fileInput {
		display: none;
	}

	.upload-button {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		border: none;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.upload-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.file-name {
		color: #666;
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
		background: #f0f0f0;
		border-radius: 6px;
	}

	.filter-section {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.filter-section h2 {
		margin: 0 0 1.5rem 0;
		color: #333;
	}

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-weight: 600;
		color: #555;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-badge {
		background: #4682b4;
		color: white;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.hint {
		background: #e9ecef;
		color: #666;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	select,
	input[type="text"] {
		padding: 0.75rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-size: 1rem;
		transition: border-color 0.3s ease;
	}

	select:focus,
	input[type="text"]:focus {
		outline: none;
		border-color: #667eea;
	}

	input[type="range"] {
		width: 100%;
		height: 8px;
		border-radius: 5px;
		background: #ddd;
		outline: none;
		-webkit-appearance: none;
	}

	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #667eea;
		cursor: pointer;
	}

	input[type="range"]::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #667eea;
		cursor: pointer;
		border: none;
	}

	.range-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #666;
		margin-top: -0.25rem;
	}

	.reset-button {
		padding: 0.75rem 1.5rem;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		margin-top: auto;
		align-self: flex-end;
		height: fit-content;
	}

	.reset-button:hover {
		background: #c0392b;
		transform: translateY(-2px);
	}

	.charts-section {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.charts-section h2 {
		margin: 0 0 1.5rem 0;
		color: #333;
	}

	.charts-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin-top: 2rem;
	}

	.chart-half {
		min-width: 0;
	}

	.fd-map-section {
		margin-top: 2rem;
	}

	.empty-state {
		background: white;
		border-radius: 12px;
		padding: 4rem 2rem;
		text-align: center;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.empty-state h2 {
		color: #333;
		margin-bottom: 1rem;
	}

	.empty-state p {
		color: #666;
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
	}

	.help-text {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 8px;
		margin-top: 1rem;
	}

	code {
		background: #2c3e50;
		color: #ecf0f1;
		padding: 0.3rem 0.6rem;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
	}

	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.loading-spinner {
		width: 60px;
		height: 60px;
		border: 4px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		color: white;
		font-size: 1.2rem;
		margin-bottom: 1rem;
	}

	.progress-bar {
		width: 300px;
		height: 8px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #4CAF50, #8BC34A);
		transition: width 0.3s ease;
	}

	.progress-text {
		color: white;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	@media (max-width: 768px) {
		.charts-row {
			grid-template-columns: 1fr;
		}

		h1 {
			font-size: 2rem;
		}

		.filter-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
