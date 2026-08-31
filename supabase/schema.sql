-- Anniv Charlotte & Antoine — base Supabase.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run.
-- Idempotent : peut être rejoué sans casser les données.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  camp text not null default 'deux' check (camp in ('charlotte','antoine','deux')),
  status text not null default 'oui' check (status in ('oui','peutetre','non')),
  plus int not null default 0 check (plus between 0 and 2),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

-- Secrets (hash du code organisateurs) : aucune policy de lecture → invisible
-- pour la clé anonyme.
create table if not exists public.config (
  key text primary key,
  value text not null
);

-- Code organisateurs par défaut : anniv1710 (modifiable depuis l'app).
insert into public.config(key, value)
values ('admin_hash', '7201071f636b8d7a7999d358e018fe7ac891685d8ffe3f336e1e8541c09acd58')
on conflict (key) do nothing;

-- Invités de départ, seulement si la table est vide.
insert into public.guests(name, camp, status, plus)
select v.name, v.camp, v.status, v.plus
from (values
  ('Charlotte B','charlotte','oui',0),
  ('Antoine B','antoine','oui',0)
) as v(name, camp, status, plus)
where not exists (select 1 from public.guests);

alter table public.guests enable row level security;
alter table public.config enable row level security;

drop policy if exists "lecture publique" on public.guests;
create policy "lecture publique" on public.guests for select using (true);
-- Pas de policy insert/update/delete : les écritures passent uniquement par
-- les fonctions ci-dessous (security definer), qui valident tout.

create or replace function public.norm_name(t text)
returns text language sql immutable
as $$ select lower(public.unaccent(trim(coalesce(t, '')))) $$;

create or replace function public.state_json()
returns jsonb language sql stable
as $$
  select jsonb_build_object(
    'guests', coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'camp', camp, 'status', status, 'plus', plus,
        'updated', to_char(updated at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ) order by created), '[]'::jsonb),
    'updated', coalesce(to_char(max(updated) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '')
  )
  from public.guests
$$;

create or replace function public.get_state()
returns jsonb language sql stable security definer set search_path = public
as $$ select public.state_json() $$;

-- Réponse d'un invité (upsert) : prénom déjà connu → mise à jour, sinon ajout.
create or replace function public.rsvp(p_name text, p_camp text, p_plus int, p_client_id text, p_status text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  g public.guests%rowtype;
  v_id uuid;
  v_status text;
  v_plus int;
begin
  if length(public.norm_name(p_name)) < 2 then
    raise exception 'Écris ton prénom (au moins 2 lettres).';
  end if;
  v_status := case when p_status in ('oui','peutetre','non') then p_status else 'oui' end;
  v_plus := least(greatest(coalesce(p_plus, 0), 0), 2);

  select * into g from public.guests
  where (p_client_id is not null and id::text = p_client_id)
     or public.norm_name(name) = public.norm_name(p_name)
  limit 1;

  if found then
    update public.guests set
      status = v_status,
      camp = case when p_camp in ('charlotte','antoine','deux') then p_camp else camp end,
      plus = v_plus,
      updated = now()
    where id = g.id;
    v_id := g.id;
  else
    begin
      v_id := p_client_id::uuid;
    exception when others then
      v_id := gen_random_uuid();
    end;
    insert into public.guests(id, name, camp, status, plus)
    values (v_id, trim(left(p_name, 60)),
      case when p_camp in ('charlotte','antoine','deux') then p_camp else 'deux' end,
      v_status, v_plus);
  end if;

  return jsonb_build_object('meId', v_id, 'state', public.state_json());
end
$$;

create or replace function public.verify_admin(p_code text)
returns boolean language sql stable security definer set search_path = public
as $$
  select encode(digest(coalesce(p_code, ''), 'sha256'), 'hex')
       = (select value from public.config where key = 'admin_hash')
$$;

-- Actions organisateurs : le code est vérifié ici, côté serveur.
create or replace function public.admin_op(p_code text, p_op text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_new text;
begin
  if not public.verify_admin(p_code) then
    raise exception 'Code organisateurs incorrect.';
  end if;
  p_payload := coalesce(p_payload, '{}'::jsonb);

  if p_op = 'code' then
    v_new := trim(coalesce(p_payload->>'code', ''));
    if length(v_new) < 4 then raise exception 'Le code doit faire au moins 4 caractères.'; end if;
    update public.config set value = encode(digest(v_new, 'sha256'), 'hex') where key = 'admin_hash';
  elsif p_op = 'add' then
    v_name := trim(left(coalesce(p_payload->>'name', ''), 60));
    if v_name = '' then raise exception 'Il manque le prénom.'; end if;
    insert into public.guests(name, camp)
    values (v_name, case when p_payload->>'camp' in ('charlotte','antoine','deux') then p_payload->>'camp' else 'deux' end);
  elsif p_op in ('rename','status','camp','plus','del') then
    v_id := (p_payload->>'id')::uuid;
    if not exists (select 1 from public.guests where id = v_id) then
      raise exception 'Invité·e introuvable — recharge la page.';
    end if;
    if p_op = 'rename' then
      v_name := trim(left(coalesce(p_payload->>'name', ''), 60));
      if v_name = '' then raise exception 'Le nom ne peut pas être vide.'; end if;
      update public.guests set name = v_name, updated = now() where id = v_id;
    elsif p_op = 'status' then
      if not (p_payload->>'status' in ('oui','non','peutetre')) then raise exception 'Statut inconnu.'; end if;
      update public.guests set status = p_payload->>'status', updated = now() where id = v_id;
    elsif p_op = 'camp' then
      if not (p_payload->>'camp' in ('charlotte','antoine','deux')) then raise exception 'Camp inconnu.'; end if;
      update public.guests set camp = p_payload->>'camp', updated = now() where id = v_id;
    elsif p_op = 'plus' then
      update public.guests set plus = least(greatest(coalesce((p_payload->>'plus')::int, 0), 0), 2), updated = now() where id = v_id;
    else
      delete from public.guests where id = v_id;
    end if;
  else
    raise exception 'Action inconnue.';
  end if;

  return public.state_json();
end
$$;
