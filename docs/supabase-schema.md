# Supabase schema

The cloud-sync schema lives in the Supabase project (it is not generated from this repo). This file
records the SQL so it isn't only living in the dashboard. All tables are RLS-scoped to the signed-in
user; the client only ever uses the public publishable anon key (RLS protects the data).

Existing tables (see `src/supabase/sync.ts`):

- **`srs_state`** — one JSONB `data` blob of SRS items per user, `updated_at`. Reconciled per item
  (last-write-wins by each item's `updatedAt`).
- **`practice_time`** — permanent per-`(day, etude_id, level, version)` log: `seconds`, `answered`,
  `correct`, `tempo`. Written via the additive RPCs `add_practice_seconds` / `add_practice_answers`
  so multiple devices SUM correctly.

## `user_settings`

A single JSONB blob of per-user preferences, modeled on `srs_state` (last-write-wins per key on
merge). Currently holds the rhythm-étude time-signature selection
(`{ rhythmMeters: { "etudeId\tlevel": { meters, updatedAt } } }`); namespaced for future settings.

```sql
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
