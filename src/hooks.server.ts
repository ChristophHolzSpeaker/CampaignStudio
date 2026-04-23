// src/hooks.server.ts
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { SetAllCookies } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';

const isProtectedRoute = (routeId: string | null): boolean =>
	typeof routeId === 'string' && routeId.startsWith('/(app)');

const requestWantsHtml = (acceptHeader: string | null): boolean =>
	typeof acceptHeader === 'string' && acceptHeader.includes('text/html');

export const handle: Handle = async ({ event, resolve }) => {
	const appliedResponseHeaderNames = new Set<string>();

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			/**
			 * Note: You have to add the `path` variable to the
			 * set and remove method due to sveltekit's cookie API
			 * requiring this to be set, setting the path to `/`
			 * will replicate previous/standard behaviour (https://kit.svelte.dev/docs/types#public-types-cookies)
			 */
			setAll: (
				cookiesToSet: Parameters<SetAllCookies>[0],
				headers: Parameters<SetAllCookies>[1]
			) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});

				const nextHeaders: Record<string, string> = {};
				for (const [name, value] of Object.entries(headers)) {
					const normalizedName = name.toLowerCase();
					if (appliedResponseHeaderNames.has(normalizedName)) {
						continue;
					}

					appliedResponseHeaderNames.add(normalizedName);
					nextHeaders[name] = value;
				}

				if (Object.keys(nextHeaders).length > 0) {
					event.setHeaders(nextHeaders);
				}
			}
		}
	});

	if (isProtectedRoute(event.route.id)) {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error || !user) {
			if (requestWantsHtml(event.request.headers.get('accept'))) {
				const redirectTo = `${event.url.pathname}${event.url.search}`;
				const loginUrl = new URL('/login', event.url);
				loginUrl.searchParams.set('redirectTo', redirectTo);
				throw redirect(303, loginUrl.pathname + loginUrl.search);
			}

			return new Response(JSON.stringify({ message: 'Unauthorized' }), {
				status: 401,
				headers: {
					'content-type': 'application/json'
				}
			});
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name: string) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
