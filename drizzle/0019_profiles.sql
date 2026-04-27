create table profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	display_name text not null,
	avatar_bucket text not null default 'avatars',
	avatar_path text,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null,
	constraint profiles_display_name_not_blank check (length(trim(display_name)) > 0),
	constraint profiles_avatar_bucket_not_blank check (length(trim(avatar_bucket)) > 0),
	constraint profiles_avatar_path_not_blank check (
		avatar_path is null
		or length(trim(avatar_path)) > 0
	)
);

create index profiles_display_name_idx on profiles (display_name);
