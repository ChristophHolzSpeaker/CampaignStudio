import { requireEnv, type WorkerEnv } from './env';

type Row = Record<string, unknown>;

type RequestOptions = {
	method?: 'GET' | 'POST' | 'PATCH';
	body?: unknown;
	prefer?: string;
};

async function request<T>(
	env: WorkerEnv,
	table: string,
	query: URLSearchParams,
	options: RequestOptions = {}
): Promise<T> {
	const supabaseUrl = requireEnv(env, 'SUPABASE_URL');
	const serviceRole = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
	const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
	url.search = query.toString();

	const response = await fetch(url, {
		method: options.method ?? 'GET',
		headers: {
			apikey: serviceRole,
			Authorization: `Bearer ${serviceRole}`,
			'Content-Type': 'application/json',
			Prefer: options.prefer ?? 'return=representation'
		},
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Supabase request failed (${response.status}): ${errorText}`);
	}

	if (response.status === 204) {
		return [] as T;
	}

	return (await response.json()) as T;
}

export async function selectMany<T extends Row>(
	env: WorkerEnv,
	table: string,
	query: URLSearchParams
): Promise<T[]> {
	return request<T[]>(env, table, query, { method: 'GET' });
}

export async function selectOne<T extends Row>(
	env: WorkerEnv,
	table: string,
	query: URLSearchParams
): Promise<T | null> {
	const rows = await selectMany<T>(env, table, query);
	return rows[0] ?? null;
}

export async function insertOne<T extends Row>(
	env: WorkerEnv,
	table: string,
	row: Row
): Promise<T> {
	const query = new URLSearchParams({ select: '*' });
	const rows = await request<T[]>(env, table, query, { method: 'POST', body: row });
	const created = rows[0];
	if (!created) {
		throw new Error(`Insert failed for table: ${table}`);
	}
	return created;
}

export async function updateMany<T extends Row>(
	env: WorkerEnv,
	table: string,
	query: URLSearchParams,
	values: Row
): Promise<T[]> {
	return request<T[]>(env, table, query, {
		method: 'PATCH',
		body: values,
		prefer: 'return=representation'
	});
}

export async function insertMany<T extends Row>(
	env: WorkerEnv,
	table: string,
	rows: Row[]
): Promise<T[]> {
	if (rows.length === 0) {
		return [];
	}

	const query = new URLSearchParams({ select: '*' });
	return request<T[]>(env, table, query, {
		method: 'POST',
		body: rows,
		prefer: 'return=representation'
	});
}

export async function upsertMany<T extends Row>(
	env: WorkerEnv,
	table: string,
	rows: Row[],
	options: {
		onConflict: string;
		ignoreDuplicates?: boolean;
	}
): Promise<T[]> {
	if (rows.length === 0) {
		return [];
	}

	const query = new URLSearchParams({
		select: '*',
		on_conflict: options.onConflict
	});

	const resolution = options.ignoreDuplicates
		? 'resolution=ignore-duplicates'
		: 'resolution=merge-duplicates';

	return request<T[]>(env, table, query, {
		method: 'POST',
		body: rows,
		prefer: `${resolution},return=representation`
	});
}

export async function upsertOne<T extends Row>(
	env: WorkerEnv,
	table: string,
	row: Row,
	options: {
		onConflict: string;
		ignoreDuplicates?: boolean;
	}
): Promise<T | null> {
	const rows = await upsertMany<T>(env, table, [row], options);
	return rows[0] ?? null;
}
