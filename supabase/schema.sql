-- =====================================================================
-- Mi MVP (by C.A.R.F.) — esquema con LOGIN (familia / entrenador)
-- =====================================================================
-- Si ya habías corrido una versión anterior de este archivo (sin
-- login), corré este completo igual: es seguro volver a ejecutarlo,
-- agrega lo que falta sin borrar datos existentes.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1) PERFILES (uno por usuario, con su rol)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'padre' check (role in ('padre', 'entrenador')),
  subscription_status text not null default 'trial', -- reservado para Mercado Pago / Stripe (próxima etapa)
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists trial_ends_at timestamptz not null default (now() + interval '7 days');

alter table public.profiles enable row level security;

create or replace function public.is_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'entrenador'
  );
$$;

-- ¿Puede este usuario cargar cosas NUEVAS (jugadores, sesiones,
-- partidos, zonas)? El entrenador y los alumnos marcados siempre
-- pueden. Una familia en "trial" puede mientras no se le venzan los
-- 7 días — pasado ese plazo, sigue viendo todo lo que ya cargó, pero
-- no puede agregar nada nuevo hasta activar un medio de pago.
create or replace function public.can_write()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select role = 'entrenador'
        or subscription_status = 'alumno_carf'
        or subscription_status = 'active'
        or (subscription_status = 'trial' and trial_ends_at > now())
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;

drop policy if exists "profiles: cada usuario lee su propio perfil" on public.profiles;
create policy "profiles: leer el propio perfil, o todos si sos entrenador"
  on public.profiles for select
  using (id = auth.uid() or public.is_coach());

drop policy if exists "profiles: entrenador actualiza estado de familias" on public.profiles;
create policy "profiles: entrenador actualiza estado de familias"
  on public.profiles for update
  using (public.is_coach())
  with check (public.is_coach());

-- Ya no existe un código de "alumno" que la familia escriba sola (se
-- podía compartir con cualquiera, no era realmente seguro). Ahora
-- toda cuenta de familia arranca en 'trial', y es el ENTRENADOR quien
-- la marca como 'alumno_carf' desde adentro de la app (pantalla
-- "Familias"), a mano, una vez que confirma que ese jugador entrena
-- en el C.A.R.F. de verdad.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, subscription_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'entrenador' then 'entrenador' else 'padre' end,
    case when new.raw_user_meta_data ->> 'role' = 'entrenador' then 'entrenador' else 'trial' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Si ya existían cuentas de entrenador creadas antes de este cambio,
-- las dejamos con el estado correcto (no les aplica cobro).
update public.profiles set subscription_status = 'entrenador' where role = 'entrenador';

-- ---------------------------------------------------------------
-- 2) JUGADORES — ahora con dueño (owner_id)
-- ---------------------------------------------------------------
create table if not exists public.players (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.players add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

alter table public.players enable row level security;
drop policy if exists "players: acceso abierto (sin login todavía)" on public.players;
drop policy if exists "players: ver los propios, o todos si sos entrenador" on public.players;
drop policy if exists "players: crear jugadores propios" on public.players;
drop policy if exists "players: editar los propios, o cualquiera si sos entrenador" on public.players;

create policy "players: ver los propios, o todos si sos entrenador"
  on public.players for select
  using (owner_id = auth.uid() or public.is_coach());

create policy "players: crear jugadores propios"
  on public.players for insert
  with check (owner_id = auth.uid() and public.can_write());

create policy "players: editar los propios, o cualquiera si sos entrenador"
  on public.players for update
  using (owner_id = auth.uid() or public.is_coach())
  with check (owner_id = auth.uid() or public.is_coach());

-- ---------------------------------------------------------------
-- 3) ENTRADAS — con dueño y la restricción real de C.A.R.F.
-- ---------------------------------------------------------------
create table if not exists public.entries (
  id text primary key,
  player_id text not null references public.players(id) on delete cascade,
  created_by uuid references public.profiles(id),
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.entries add column if not exists created_by uuid references public.profiles(id);

alter table public.entries enable row level security;
drop policy if exists "entries: acceso abierto (sin login todavía)" on public.entries;
drop policy if exists "entries: ver las del jugador propio, o todas si sos entrenador" on public.entries;
drop policy if exists "entries: cargar entradas propias (CARF sólo entrenador)" on public.entries;

create policy "entries: ver las del jugador propio, o todas si sos entrenador"
  on public.entries for select
  using (
    exists (
      select 1 from public.players p
      where p.id = entries.player_id
        and (p.owner_id = auth.uid() or public.is_coach())
    )
  );

-- Esta es la política que garantiza, a nivel de base de datos, que
-- sólo el entrenador puede cargar sesiones de C.A.R.F. (la evaluación
-- técnica propia). Ningún padre puede saltearla editando la app.
create policy "entries: cargar entradas propias (CARF sólo entrenador)"
  on public.entries for insert
  with check (
    created_by = auth.uid()
    and public.can_write()
    and exists (
      select 1 from public.players p
      where p.id = entries.player_id
        and (p.owner_id = auth.uid() or public.is_coach())
    )
    and (
      public.is_coach()
      or not (type = 'sesion' and payload #>> '{data,lugar}' = 'C.A.R.F.')
    )
  );

-- ---------------------------------------------------------------
-- 4) Permisos de tabla
-- ---------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert on public.entries to authenticated;
