// src/routes/(auth)/register/+page.server.ts
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_APP_REGISTER_TOKEN } from '$env/static/private';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	if (url.searchParams.get('t') !== PRIVATE_APP_REGISTER_TOKEN) {
		throw error(403, { message: 'Not permitted' });
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
