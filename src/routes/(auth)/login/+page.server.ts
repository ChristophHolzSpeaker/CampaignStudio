// src/routes/(auth)/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const {
		data: { session }
	} = await supabase.auth.getSession();

	// if the user is already logged in return them to the account page
	if (session) {
		redirect(303, '/account');
	}

	return { url: url.origin };
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

		throw redirect(303, '/account');
	}
};
