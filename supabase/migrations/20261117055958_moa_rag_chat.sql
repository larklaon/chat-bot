create extension if not exists vector with schema extensions;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  source_path text not null,
  title text not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding extensions.vector(1024) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_path, chunk_index)
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists documents_source_chunk_idx
  on public.documents (source_path, chunk_index);
create index if not exists documents_embedding_hnsw_idx
  on public.documents using hnsw (embedding extensions.vector_cosine_ops);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;

drop policy if exists "Users can read their conversations" on public.conversations;
create policy "Users can read their conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their conversations" on public.conversations;
create policy "Users can create their conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their conversations" on public.conversations;
create policy "Users can update their conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their conversations" on public.conversations;
create policy "Users can delete their conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their messages" on public.messages;
create policy "Users can read their messages"
  on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create messages in their conversations" on public.messages;
create policy "Users can create messages in their conversations"
  on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "Authenticated users can read knowledge documents" on public.documents;
create policy "Authenticated users can read knowledge documents"
  on public.documents for select to authenticated
  using (true);

create or replace function public.match_documents(
  query_embedding extensions.vector(1024),
  match_threshold real default 0.35,
  match_count integer default 5
)
returns table (
  id uuid,
  source_path text,
  title text,
  chunk_index integer,
  content text,
  similarity real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    d.id,
    d.source_path,
    d.title,
    d.chunk_index,
    d.content,
    (1 - (d.embedding <=> query_embedding))::real as similarity
  from public.documents d
  where 1 - (d.embedding <=> query_embedding) >= match_threshold
  order by d.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 8);
$$;

grant usage on schema public to authenticated;
grant usage on schema extensions to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.documents to authenticated;
revoke all on function public.match_documents(extensions.vector, real, integer) from public, anon;
grant execute on function public.match_documents(extensions.vector, real, integer) to authenticated;
