-- ============================================================
-- Roots — esquema Supabase (Auth + mapa mental + SRS en la nube)
-- Ejecutar en Supabase Dashboard → SQL Editor → New query.
-- Todo con RLS: cada usuario solo lee/escribe SUS filas.
-- ============================================================

-- 1) profiles — 1 fila por usuario (nivel, idioma objetivo, racha, XP)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  level text,                          -- rung CEFR ("A1".."C2") o tier legacy
  cefr text,                           -- CEFR resuelto del quiz adaptativo
  target_language text default 'en',   -- 'en' | 'es' | 'fr' | ... (multi-idioma futuro)
  streak jsonb,                        -- { current, best, lastActive }
  progression jsonb,                   -- { xp, level, streak, wordExamplesEarned }
  onboarded boolean default false,
  updated_at timestamptz default now()
);

-- 2) words — nodos de palabras del mapa (1 fila por palabra por usuario)
create table if not exists public.words (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,               -- id del nodo en el mapa (ej. "deadline")
  en text not null,
  def text default '',
  def_es text default '',
  cat text default '',
  pos text,                            -- noun | verb | adj | adv | pron | pattern
  kind text default 'word',            -- word | pattern
  cefr text,                           -- CEFR del pattern node (null en palabras)
  data jsonb,                          -- documento completo (images, userExamples, tags…)
  updated_at timestamptz default now(),
  unique (user_id, word_id)
);
create index if not exists words_user_idx on public.words(user_id);

-- 3) edges — aristas: word↔word (conexiones) y word↔pattern (patternOf)
create table if not exists public.edges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  edge_key text not null,              -- "source::target::rel::idx" (idempotencia de upsert)
  source text not null,
  target text not null,
  rel text default 'link',             -- link | patternOf | uses
  sentence text default '',
  weight real default 0.5,             -- frecuencia de repaso (densidad del grafo)
  updated_at timestamptz default now(),
  unique (user_id, edge_key)
);
create index if not exists edges_user_idx on public.edges(user_id);

-- 4) srs_cards — estado de repetición espaciada (palabras + patterns)
create table if not exists public.srs_cards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_key text not null,              -- id de palabra o "lvlN-agent-verb-object" de patterns
  interval real default 1,
  ease real default 2.5,
  reps int default 0,
  due timestamptz,
  payload jsonb,                       -- documento SRS completo
  updated_at timestamptz default now(),
  unique (user_id, card_key)
);
create index if not exists srs_user_idx on public.srs_cards(user_id);

-- ============================================================
-- Row Level Security: cada usuario SOLO toca SUS filas
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.words     enable row level security;
alter table public.edges     enable row level security;
alter table public.srs_cards enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own words" on public.words;
create policy "own words" on public.words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own edges" on public.edges;
create policy "own edges" on public.edges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own srs" on public.srs_cards;
create policy "own srs" on public.srs_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- auto-crear profile al registrarse (trigger)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
