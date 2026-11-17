create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);
