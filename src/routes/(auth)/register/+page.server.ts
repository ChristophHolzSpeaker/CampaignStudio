// src/routes/(auth)/register/+page.server.ts
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
		const confirmPassword = formData.get('confirmPassword') as string;

		// Basic validation
		if (!email) {
			return fail(400, { errors: { email: 'Email is required' }, email });
		}

		if (!password) {
			return fail(400, { errors: { password: 'Password is required' }, password });
		}

		if (password !== confirmPassword) {
			return fail(400, {
				errors: { confirmPassword: 'Passwords do not match' },
				password,
				confirmPassword
			});
		}

		const { error } = await supabase.auth.signUp({
			email,
			password
		});

		if (error) {
			return fail(400, {
				success: false,
				email,
				message: error.message
			});
		}

		return {
			success: true,
			message: 'Please check your email to confirm your account'
		};
	}
};
