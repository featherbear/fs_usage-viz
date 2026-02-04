<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		BarController,
		BarElement,
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
	export let title: string = 'Operations Over Time';

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	// Register Chart.js components
	Chart.register(
		CategoryScale,
		LinearScale,
		BarController,
		BarElement,
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

		const chartData = sortedBins.map(([time, entries]) => ({
			x: time,
			y: entries.length
		}));

		// Calculate appropriate bar thickness based on bin size and chart width
		const chartWidth = canvas.parentElement?.clientWidth || 800;
		const timeRange = sortedBins.length > 1 
			? sortedBins[sortedBins.length - 1][0].getTime() - sortedBins[0][0].getTime()
			: binSizeSeconds * 1000;
		const pixelsPerMs = chartWidth / (timeRange || 1);
		const barThickness = Math.max(1, Math.floor(pixelsPerMs * binSizeSeconds * 1000 * 0.9));

		if (chart) {
			chart.destroy();
		}

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				datasets: [
					{
						label: 'Operations',
						data: chartData,
						backgroundColor: 'rgba(70, 130, 180, 0.7)',
						borderColor: 'rgba(70, 130, 180, 1)',
						borderWidth: 1,
						barThickness: barThickness
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: entries.length > 10000 ? false : undefined,
				plugins: {
					title: {
						display: true,
						text: `${title} (bin: ${binSizeSeconds}s, total: ${entries.length.toLocaleString()} ops)`
					},
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const value = context.parsed.y;
								return `Operations: ${value.toLocaleString()}`;
							}
						}
					},
					decimation: {
						enabled: sortedBins.length > 500,
						algorithm: 'lttb',
						samples: 1000
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
						},
						offset: false
					},
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Number of Operations'
						},
						ticks: {
							callback: function(value) {
								return value.toLocaleString();
							}
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

	$: if (canvas && (entries || binSizeSeconds)) {
		updateChart();
	}
</script>

<div class="chart-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-container {
		position: relative;
		width: 100%;
		height: 400px;
		margin: 1rem 0;
	}
</style>
