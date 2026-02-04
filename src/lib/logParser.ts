/**
 * Log entry structure parsed from fs_usage output
 */
export interface LogEntry {
	timestamp: Date;
	operation: string;
	fileDescriptor: string | null;
	bytes: string | null;
	device: string | null;
	path: string | null;
	duration: number;
	process: string;
}

/**
 * Parses a single line from fs_usage log output
 */
export function parseLine(line: string): LogEntry | null {
	line = line.trim();
	if (!line) return null;

	// Extract timestamp (HH:MM:SS.microseconds)
	const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+)/);
	if (!timestampMatch) return null;

	const timestampStr = timestampMatch[1];
	const [hours, minutes, seconds] = timestampStr.split(':');
	const [sec, microsec] = seconds.split('.');

	const timestamp = new Date();
	timestamp.setHours(parseInt(hours));
	timestamp.setMinutes(parseInt(minutes));
	timestamp.setSeconds(parseInt(sec));
	timestamp.setMilliseconds(parseInt(microsec.slice(0, 3)));

	// Remove timestamp from line
	line = line.slice(timestampStr.length).trim();

	// Extract operation
	const operationMatch = line.match(/^(\S+)/);
	if (!operationMatch) return null;
	const operation = operationMatch[1];
	line = line.slice(operation.length).trim();

	// Extract file descriptor (F=XX)
	const fdMatch = line.match(/F=(\d+)/);
	const fileDescriptor = fdMatch ? fdMatch[1] : null;

	// Extract bytes (B=0xXXX or B=number)
	const bytesMatch = line.match(/B=(0x[0-9a-fA-F]+|\d+)/);
	const bytes = bytesMatch ? bytesMatch[1] : null;

	// Extract device (D=0xXXXX)
	const deviceMatch = line.match(/D=(0x[0-9a-fA-F]+)/);
	const device = deviceMatch ? deviceMatch[1] : null;

	// Extract duration and process (at the end of line)
	// Format: 0.000005   process.name
	const durationMatch = line.match(/(\d+\.\d+)\s+([^\s]+)\s*$/);
	let duration = 0.0;
	let process = 'unknown';

	if (durationMatch) {
		duration = parseFloat(durationMatch[1]);
		process = durationMatch[2];
	}

	// Extract path - everything between /dev/ or /Users/ or /Library/ or /OS/ and the duration
	const pathMatch = line.match(/(\S*\/[^\s]+(?:\s+[^\s\/]+)*?)(?:\s+\d+\.\d+\s+)/);
	const path = pathMatch ? pathMatch[1].trim() : null;

	return {
		timestamp,
		operation,
		fileDescriptor,
		bytes,
		device,
		path,
		duration,
		process
	};
}

/**
 * Parses the entire log file content
 * Optimized for large files
 */
export function parseLogFile(content: string): LogEntry[] {
	const lines = content.split('\n');
	const entries: LogEntry[] = [];
	const batchSize = 5000;

	// Process in batches to avoid blocking
	for (let i = 0; i < lines.length; i += batchSize) {
		const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
		for (const line of batch) {
			const entry = parseLine(line);
			if (entry) {
				entries.push(entry);
			}
		}
	}

	return entries;
}

/**
 * Bins log entries by time intervals
 */
export function binByTime(entries: LogEntry[], binSizeSeconds: number): Map<Date, LogEntry[]> {
	if (entries.length === 0) return new Map();

	const bins = new Map<number, LogEntry[]>();
	const minTime = entries.reduce((min, e) => (e.timestamp < min ? e.timestamp : min), entries[0].timestamp);

	for (const entry of entries) {
		const elapsed = (entry.timestamp.getTime() - minTime.getTime()) / 1000;
		const binIndex = Math.floor(elapsed / binSizeSeconds);
		const binStartTime = minTime.getTime() + binIndex * binSizeSeconds * 1000;

		if (!bins.has(binStartTime)) {
			bins.set(binStartTime, []);
		}
		bins.get(binStartTime)!.push(entry);
	}

	// Convert back to Map<Date, LogEntry[]> for the return type
	const result = new Map<Date, LogEntry[]>();
	for (const [time, entries] of bins) {
		result.set(new Date(time), entries);
	}

	return result;
}

/**
 * Filters entries by file descriptor
 */
export function filterByFileDescriptor(entries: LogEntry[], fd: string): LogEntry[] {
	return entries.filter((e) => e.fileDescriptor === fd);
}

/**
 * Filters entries by path pattern (case-insensitive substring match)
 */
export function filterByPath(entries: LogEntry[], pathPattern: string, caseSensitive = false): LogEntry[] {
	if (caseSensitive) {
		return entries.filter((e) => e.path && e.path.includes(pathPattern));
	} else {
		const pattern = pathPattern.toLowerCase();
		return entries.filter((e) => e.path && e.path.toLowerCase().includes(pattern));
	}
}

/**
 * Gets summary statistics from log entries
 */
export function getSummaryStats(entries: LogEntry[]) {
	if (entries.length === 0) {
		return null;
	}

	const minTime = entries.reduce((min, e) => (e.timestamp < min ? e.timestamp : min), entries[0].timestamp);
	const maxTime = entries.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), entries[0].timestamp);
	const durationSeconds = (maxTime.getTime() - minTime.getTime()) / 1000;

	// Operation counts
	const operationCounts = new Map<string, number>();
	entries.forEach((e) => {
		operationCounts.set(e.operation, (operationCounts.get(e.operation) || 0) + 1);
	});

	// File descriptor counts
	const fdCounts = new Map<string, number>();
	entries.forEach((e) => {
		if (e.fileDescriptor) {
			fdCounts.set(e.fileDescriptor, (fdCounts.get(e.fileDescriptor) || 0) + 1);
		}
	});

	// Path counts
	const pathCounts = new Map<string, number>();
	entries.forEach((e) => {
		if (e.path) {
			pathCounts.set(e.path, (pathCounts.get(e.path) || 0) + 1);
		}
	});

	// Duration statistics
	const durations = entries.map((e) => e.duration);
	let minDuration = Infinity;
	let maxDuration = -Infinity;
	let sumDuration = 0;
	
	for (const duration of durations) {
		if (duration < minDuration) minDuration = duration;
		if (duration > maxDuration) maxDuration = duration;
		sumDuration += duration;
	}
	
	const avgDuration = durations.length > 0 ? sumDuration / durations.length : 0;

	return {
		totalEntries: entries.length,
		minTime,
		maxTime,
		durationSeconds,
		operationCounts: Array.from(operationCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10),
		allOperationCounts: Array.from(operationCounts.entries())
			.sort((a, b) => b[1] - a[1]),
		fdCounts: Array.from(fdCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10),
		allFdCounts: Array.from(fdCounts.entries())
			.sort((a, b) => b[1] - a[1]),
		pathCounts: Array.from(pathCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10),
		allPathCounts: Array.from(pathCounts.entries())
			.sort((a, b) => b[1] - a[1]),
		uniqueOperations: operationCounts.size,
		uniqueFds: fdCounts.size,
		entriesWithPath: pathCounts.size,
		minDuration: minDuration * 1000, // Convert to ms
		maxDuration: maxDuration * 1000,
		avgDuration: avgDuration * 1000
	};
}
