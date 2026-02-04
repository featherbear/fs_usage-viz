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

		const labels = sortedBins.map(([time]) => time);
		const counts = sortedBins.map(([, entries]) => entries.length);

		if (chart) {
			chart.destroy();
		}

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Operations',
						data: counts,
						backgroundColor: 'rgba(70, 130, 180, 0.7)',
						borderColor: 'rgba(70, 130, 180, 1)',
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `${title} (bin: ${binSizeSeconds}s, total: ${entries.length} ops)`
					},
					legend: {
						display: false
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
							text: 'Number of Operations'
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
