// src/routes/(auth)/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const {
		data: { session },
		error
	} = await supabase.auth.getSession();
	const user = session?.user ?? null;

	if (user && !error) {
		throw redirect(303, '/campaigns');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const {
			request,
			locals: { supabase }
		} = event;
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		// Basic validation
		if (!email || !password) {
			return fail(400, {
				errors: {
					email: !email ? 'Email is required' : undefined,
					password: !password ? 'Password is required' : undefined
				},
				email,
				password
			});
		}

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			return fail(400, {
				success: false,
				email,
				message: 'Invalid email or password'
			});
		}

		throw redirect(303, '/campaigns');
	}
};
