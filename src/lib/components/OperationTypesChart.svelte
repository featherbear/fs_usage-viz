<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		BarController,
		BarElement,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';
	import type { LogEntry } from '$lib/logParser';

	export let entries: LogEntry[] = [];

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	// Register Chart.js components
	Chart.register(CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend);

	function updateChart() {
		if (!canvas || entries.length === 0) return;

		const operationCounts = new Map<string, number>();
		entries.forEach((e) => {
			operationCounts.set(e.operation, (operationCounts.get(e.operation) || 0) + 1);
		});

		const topOps = Array.from(operationCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		const labels = topOps.map(([op]) => op);
		const counts = topOps.map(([, count]) => count);

		if (chart) {
			chart.destroy();
		}

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Count',
						data: counts,
						backgroundColor: 'rgba(255, 127, 80, 0.7)',
						borderColor: 'rgba(255, 127, 80, 1)',
						borderWidth: 1
					}
				]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: 'Top 10 Operation Types'
					},
					legend: {
						display: false
					}
				},
				scales: {
					x: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Count'
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
