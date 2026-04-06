/** @type {import('tailwindcss').Config} */
const config = {
	content: ['./src/**/*.{svelte,ts,js,css,html}'],
	theme: {
		extend: {
			colors: {
				primary: 'var(--color-primary)',
				secondary: 'var(--color-secondary)',
				tertiary: 'var(--color-tertiary)',
				'on-surface': 'var(--color-on-surface)',
				surface: 'var(--surface)',
				'surface-card': 'var(--surface-card)',
				'surface-container-low': 'var(--color-surface-container-low)',
				'surface-container-lowest': 'var(--color-surface-container-lowest)',
				accent: 'var(--accent)',
				'accent-mid': 'var(--accent-mid)',
				'accent-strong': 'var(--accent-strong)'
			},
			fontFamily: {
				sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif']
			}
		}
	}
};

export default config;
