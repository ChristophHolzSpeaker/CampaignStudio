export type StrategyEntry = {
	key: string;
	value: string;
};

const formatValue = (value: unknown): string => {
	if (value === null || value === undefined) {
		return 'N/A';
	}

	if (Array.isArray(value)) {
		return value.map((entry) => formatValue(entry)).join(', ');
	}

	if (typeof value === 'object') {
		return JSON.stringify(value);
	}

	return String(value);
};

export const strategyEntries = (strategy?: Record<string, unknown> | null): StrategyEntry[] => {
	if (!strategy || typeof strategy !== 'object' || Array.isArray(strategy)) {
		return [];
	}

	return Object.entries(strategy).map(([key, value]) => ({
		key,
		value: formatValue(value)
	}));
};
