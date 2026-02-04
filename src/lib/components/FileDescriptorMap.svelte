<script lang="ts">
	import type { LogEntry } from '$lib/logParser';
	import tippy from 'tippy.js';
	import 'tippy.js/dist/tippy.css';

	export let entries: LogEntry[] = [];

	let isExpanded = false;
	let fdFilter = '';
	let pidFilter = '';
	let isFiltering = false;
	let isLoadingExpansion = false;
	let filterTimeout: number | undefined;
	let filteredKeys: string[] = [];

	// Build a map of (process, file descriptor) to paths with operation counts
	// File descriptors are per-process, not global!
	$: fdToPathsMap = buildFdToPathsMap(entries);

	interface PathInfo {
		path: string;
		count: number;
		firstSeen: Date;
		lastSeen: Date;
	}

	function buildFdToPathsMap(entries: LogEntry[]): Map<string, { process: string; fd: string; paths: PathInfo[] }> {
		const processFdMap = new Map<string, Map<string, PathInfo>>();

		for (const entry of entries) {
			if (!entry.fileDescriptor || !entry.path) continue;

			// Key is "process::fd" since FDs are per-process
			const key = `${entry.process}::${entry.fileDescriptor}`;
			if (!processFdMap.has(key)) {
				processFdMap.set(key, new Map());
			}

			const pathMap = processFdMap.get(key)!;
			if (pathMap.has(entry.path)) {
				const info = pathMap.get(entry.path)!;
				info.count++;
				if (entry.timestamp > info.lastSeen) {
					info.lastSeen = entry.timestamp;
				}
				if (entry.timestamp < info.firstSeen) {
					info.firstSeen = entry.timestamp;
				}
			} else {
				pathMap.set(entry.path, {
					path: entry.path,
					count: 1,
					firstSeen: entry.timestamp,
					lastSeen: entry.timestamp
				});
			}
		}

		// Convert to sorted list
		const result = new Map<string, { process: string; fd: string; paths: PathInfo[] }>();
		for (const [key, pathMap] of processFdMap) {
			const [process, fd] = key.split('::');
			const paths = Array.from(pathMap.values()).sort((a, b) => b.count - a.count);
			result.set(key, { process, fd, paths });
		}

		return result;
	}

	$: sortedKeys = Array.from(fdToPathsMap.keys()).sort((a, b) => {
		const [procA, fdA] = a.split('::');
		const [procB, fdB] = b.split('::');
		// Sort by process name, then by FD number
		if (procA !== procB) return procA.localeCompare(procB);
		return Number.parseInt(fdA) - Number.parseInt(fdB);
	});

	// Trigger filtering when inputs change
	$: if (sortedKeys) {
		applyFilters();
	}

	$: if (fdFilter !== undefined || pidFilter !== undefined) {
		applyFilters();
	}

	function applyFilters() {
		if (filterTimeout) {
			clearTimeout(filterTimeout);
		}

		isFiltering = true;

		filterTimeout = setTimeout(() => {
			filteredKeys = sortedKeys.filter(key => {
				const [process, fd] = key.split('::');
				const fdMatch = !fdFilter.trim() || fd.includes(fdFilter.trim());
				const pidMatch = !pidFilter.trim() || process.toLowerCase().includes(pidFilter.trim().toLowerCase());
				return fdMatch && pidMatch;
			});
			isFiltering = false;
		}, 150) as unknown as number;
	}

	function tooltip(node: HTMLElement, options: { content: string }) {
		const instance = tippy(node, {
			content: options.content,
			placement: 'top',
			arrow: true,
			theme: 'light-border',
			maxWidth: 600,
			allowHTML: false
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

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		alert('Copied to clipboard!');
	}
	
	function handleToggle() {
		if (!isExpanded) {
			isLoadingExpansion = true;
			isExpanded = true;
			// Allow the UI to render before processing data
			setTimeout(() => {
				isLoadingExpansion = false;
			}, 200);
		} else {
			isExpanded = false;
		}
	}
	
	function getProcessShortName(fullProcess: string): string {
		// Extract just the process name, handle format like "com.crowdstrike.falcon.Agent.6223798"
		const parts = fullProcess.split('.');
		return 'PID ' + parts[parts.length - 1];
	}
</script>

{#if fdToPathsMap.size > 0}
	<div class="fd-map-container">
		<div class="fd-map-header">
			<h2 on:click={handleToggle} class="collapsible-header">
				<span class="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
				🔗 File Descriptor → Path Mapping
				<span class="entry-count">({fdToPathsMap.size} mappings)</span>
			</h2>
		</div>

		{#if isExpanded}
			{#if isLoadingExpansion}
				<div class="loading-overlay">
					<div class="spinner"></div>
					<span class="loading-text">Loading mappings...</span>
				</div>
			{:else}
				<p class="description">
					File descriptors are per-process. This shows which files were accessed through each FD within each process. Multiple paths indicate the FD was reused over time.
				</p>

			<div class="search-section">
				<div class="filter-group">
					<label for="fdFilter">File Descriptor:</label>
					<div class="input-wrapper">
						<input
							id="fdFilter"
							type="text"
							bind:value={fdFilter}
							placeholder="e.g. 40"
							class="search-input"
						/>
						{#if fdFilter}
							<button class="clear-btn" on:click={() => fdFilter = ''}>✕</button>
						{/if}
					</div>
				</div>
				<div class="filter-group">
					<label for="pidFilter">Process ID:</label>
					<div class="input-wrapper">
						<input
							id="pidFilter"
							type="text"
							bind:value={pidFilter}
							placeholder="e.g. 6223798"
							class="search-input"
						/>
						{#if pidFilter}
							<button class="clear-btn" on:click={() => pidFilter = ''}>✕</button>
						{/if}
					</div>
				</div>
				{#if (fdFilter || pidFilter) && filteredKeys.length < sortedKeys.length}
					<span class="filter-info">Showing {filteredKeys.length} of {sortedKeys.length} mappings</span>
				{/if}
			</div>

			{#if isFiltering}
				<div class="loading-overlay">
					<div class="spinner"></div>
					<span class="loading-text">Filtering...</span>
				</div>
			{:else}
				<div class="fd-grid">
				{#each filteredKeys as key}
				{@const data = fdToPathsMap.get(key)}
				{#if data}
					<div class="fd-card">
						<div class="fd-header">
							<div class="fd-header-main">
								<span class="fd-label">F={data.fd}</span>
								<span class="process-name" use:tooltip={{ content: data.process }}>
									{getProcessShortName(data.process)}
								</span>
							</div>
							<span class="path-count">{data.paths.length} path{data.paths.length === 1 ? '' : 's'}</span>
						</div>
						<div class="paths-list">
							{#each data.paths as pathInfo, i}
								<div class="path-item">
									<span class="path-index">{i + 1}.</span>
									<button
										class="path-text"
										use:tooltip={{ content: pathInfo.path }}
										on:click={() => copyToClipboard(pathInfo.path)}
									>
										{pathInfo.path.length > 60 ? pathInfo.path.slice(0, 60) + '...' : pathInfo.path}
									</button>
									<div class="path-stats">
										<span class="op-count" use:tooltip={{ content: `${pathInfo.count.toLocaleString()} operations` }}>
											{pathInfo.count.toLocaleString()} ops
										</span>
										{#if data.paths.length > 1}
											<span class="time-range" use:tooltip={{ content: `Active: ${pathInfo.firstSeen.toLocaleTimeString()} - ${pathInfo.lastSeen.toLocaleTimeString()}` }}>
												🕒 {pathInfo.firstSeen.toLocaleTimeString()} - {pathInfo.lastSeen.toLocaleTimeString()}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
		{/if}			{/if}		{/if}
	</div>
{:else}
	<div class="no-data">
		<p>No file descriptor → path mappings found in the log entries.</p>
	</div>
{/if}

<style>
	.fd-map-container {
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		margin: 1rem 0;
	}

	.fd-map-header {
		margin-bottom: 1rem;
	}

	.collapsible-header {
		cursor: pointer;
		user-select: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: color 0.2s;
	}

	.collapsible-header:hover {
		color: #4682b4;
	}

	.toggle-icon {
		font-size: 0.8rem;
		transition: transform 0.2s;
	}

	.entry-count {
		font-size: 0.9rem;
		color: #666;
		font-weight: normal;
	}

	.search-section {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		align-items: end;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-weight: 600;
		color: #555;
		font-size: 0.9rem;
	}

	.input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input {
		flex: 1;
		width: 100%;
		padding: 0.75rem 2.5rem 0.75rem 1rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-size: 0.95rem;
		transition: border-color 0.3s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: #4682b4;
	}

	.clear-btn {
		position: absolute;
		right: 0.5rem;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		transition: background 0.2s;
	}

	.clear-btn:hover {
		background: #c0392b;
	}

	.filter-info {
		color: #4682b4;
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.loading-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		background: #f8f9fa;
		border-radius: 8px;
		border: 2px dashed #ddd;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid rgba(70, 130, 180, 0.2);
		border-top-color: #4682b4;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		color: #666;
		font-size: 0.95rem;
		font-weight: 500;
	}

	h2 {
		margin: 0 0 0.5rem 0;
		color: #333;
		border-bottom: 2px solid #4682b4;
		padding-bottom: 0.5rem;
	}

	.description {
		color: #666;
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
		font-style: italic;
	}

	.fd-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
		gap: 1rem;
		max-height: 800px;
		overflow-y: auto;
	}

	.fd-card {
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 6px;
		overflow: hidden;
	}

	.fd-header {
		background: #4682b4;
		color: white;
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.fd-header-main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.fd-label {
		font-weight: 600;
		font-family: monospace;
		font-size: 1.1rem;
	}
	
	.process-name {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-family: monospace;
		cursor: help;
	}

	.path-count {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.paths-list {
		padding: 0.75rem;
	}

	.path-item {
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		background: white;
		border-radius: 4px;
		border: 1px solid #e9ecef;
	}

	.path-item:last-child {
		margin-bottom: 0;
	}

	.path-index {
		color: #999;
		font-weight: 500;
		min-width: 1.5rem;
		display: inline-block;
	}

	.path-text {
		color: #333;
		font-family: monospace;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: background 0.2s;
		display: inline-block;
		background: transparent;
		border: none;
		text-align: left;
	}

	.path-text:hover {
		background: #e3f2fd;
		color: #1976d2;
	}

	.path-stats {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		padding-left: 1.5rem;
		font-size: 0.8rem;
	}

	.op-count {
		color: #28a745;
		font-weight: 600;
	}

	.time-range {
		color: #666;
		font-family: monospace;
		font-size: 0.75rem;
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
</style>
