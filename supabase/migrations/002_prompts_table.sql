-- Adds the prompt library so campaigns can borrow audience/format-aware prompt templates
create table prompts (
    id serial primary key,
    name text not null,
    purpose text not null,
    audience text not null,
    format text not null,
    topic text,
    model text not null,
    system_prompt text not null,
    user_prompt_template text not null,
    metadata jsonb,
    is_active boolean not null default true,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create unique index prompts_unique_key on prompts (purpose, audience, format, topic);
create index prompts_active_idx on prompts (is_active) where is_active;
