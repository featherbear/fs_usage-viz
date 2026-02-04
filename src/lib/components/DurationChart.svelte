<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		Title,
		Tooltip,
		Legend,
		Filler,
		TimeScale
	} from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import type { LogEntry } from '$lib/logParser';
	import { binByTime } from '$lib/logParser';

	export let entries: LogEntry[] = [];
	export let binSizeSeconds: number = 1.0;

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;
	let showPoints: boolean = false;

	// Register Chart.js components
	Chart.register(
		CategoryScale,
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		Title,
		Tooltip,
		Legend,
		Filler,
		TimeScale
	);

	function updateChart() {
		if (!canvas || entries.length === 0) return;

		const bins = binByTime(entries, binSizeSeconds);
		const sortedBins = Array.from(bins.entries()).sort((a, b) => a[0].getTime() - b[0].getTime());

		const labels = sortedBins.map(([time]) => time);
		const avgDurations = sortedBins.map(([, entries]) => {
			const durations = entries.map((e) => e.duration * 1000);
			return durations.reduce((sum, d) => sum + d, 0) / durations.length;
		});
		const maxDurations = sortedBins.map(([, entries]) => {
			const durations = entries.map((e) => e.duration * 1000);
			return Math.max(...durations);
		});

		if (chart) {
			chart.destroy();
		}

		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Avg Duration (ms)',
						data: avgDurations,
						backgroundColor: 'rgba(46, 204, 113, 0.3)',
						borderColor: 'rgba(46, 204, 113, 1)',
						borderWidth: 2,
						fill: true,
						tension: 0.4,
						pointRadius: showPoints ? 3 : 0,
						pointHoverRadius: showPoints ? 5 : 0
					},
					{
						label: 'Max Duration (ms)',
						data: maxDurations,
						backgroundColor: 'rgba(231, 76, 60, 0.3)',
						borderColor: 'rgba(231, 76, 60, 1)',
						borderWidth: 2,
						fill: true,
						tension: 0.4,
						pointRadius: showPoints ? 3 : 0,
						pointHoverRadius: showPoints ? 5 : 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `Operation Duration Analysis (bin: ${binSizeSeconds}s)`
					}
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'second',
							displayFormats: {
								second: 'HH:mm:ss'
							}
						},
						title: {
							display: true,
							text: 'Time'
						}
					},
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Duration (ms)'
						}
					}
				}
			}
		});
	}

	onMount(() => {
		updateChart();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});

	$: if (canvas && entries) {
		updateChart();
	}

	$: if (canvas && showPoints !== undefined) {
		updateChart();
	}
</script>

<div class="chart-wrapper">
	<div class="chart-controls">
		<label class="toggle-label">
			<input type="checkbox" bind:checked={showPoints} />
			<span>Show data points</span>
		</label>
	</div>
	<div class="chart-container">
		<canvas bind:this={canvas}></canvas>
	</div>
</div>

<style>
	.chart-wrapper {
		margin: 1rem 0;
	}

	.chart-controls {
		display: flex;
		justify-content: flex-end;
		padding: 0.5rem 1rem;
		background: #f8f9fa;
		border-radius: 8px 8px 0 0;
		border-bottom: 1px solid #e9ecef;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #555;
		cursor: pointer;
		user-select: none;
	}

	.toggle-label input[type="checkbox"] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}

	.toggle-label:hover {
		color: #333;
	}

	.chart-container {
		position: relative;
		width: 100%;
		height: 400px;
		background: white;
		border-radius: 0 0 8px 8px;
	}
</style>
