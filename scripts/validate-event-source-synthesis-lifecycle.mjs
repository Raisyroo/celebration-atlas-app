import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration007 = await readFile(
  path.join(root, 'supabase/migrations/007_event_source_synthesis.sql'),
  'utf8',
);
const migration012 = await readFile(
  path.join(root, 'supabase/migrations/012_model_assisted_editorial_synthesis.sql'),
  'utf8',
);
const migration020 = await readFile(
  path.join(root, 'supabase/migrations/020_preserve_deterministic_editorial_parent.sql'),
  'utf8',
);

const db = new PGlite();

async function one(sql, params = []) {
  const result = await db.query(sql, params);
  assert.equal(result.rows.length, 1, `Expected one row from: ${sql}`);
  return result.rows[0];
}

async function scalar(sql, params = []) {
  return Object.values(await one(sql, params))[0];
}

async function insertBundle() {
  return scalar(`
    insert into public.event_source_bundles (status)
    values ('ready_for_synthesis')
    returning id
  `);
}

async function createDeterministic(bundleId, hashCharacter) {
  return one(`
    select *
    from public.atlas_create_event_source_synthesis(
      $1::uuid,
      'deterministic'::text,
      'deterministic-lifecycle-test'::text,
      $2::text,
      '{}'::jsonb,
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      true,
      1::numeric,
      null::text,
      null::text,
      null::text,
      'lifecycle-test'::text
    )
  `, [bundleId, hashCharacter.repeat(64)]);
}

async function createEditorial(parentId, hashCharacter = 'b') {
  return one(`
    select *
    from public.atlas_create_model_assisted_synthesis(
      $1::uuid,
      'editorial-lifecycle-test'::text,
      $2::text,
      '{}'::jsonb,
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      true,
      1::numeric,
      'test-provider'::text,
      'test-model'::text,
      null::text,
      'lifecycle-test'::text
    )
  `, [parentId, hashCharacter.repeat(64)]);
}

async function transition(synthesisId, action) {
  return one(`
    select *
    from public.atlas_transition_event_source_synthesis(
      $1::uuid,
      $2::text,
      'lifecycle-test'::text,
      'focused lifecycle fixture'::text
    )
  `, [synthesisId, action]);
}

async function status(synthesisId) {
  return scalar(
    'select status from public.event_source_syntheses where id = $1::uuid',
    [synthesisId],
  );
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create table public.event_source_bundles (
      id uuid primary key default gen_random_uuid(),
      name text not null default 'Lifecycle fixture',
      status text not null check (
        status in ('collecting', 'ready_for_synthesis', 'synthesis_in_progress', 'draft_ready', 'archived')
      ),
      event_key text,
      updated_at timestamptz not null default now()
    );

    create table public.event_source_bundle_actions (
      id uuid primary key default gen_random_uuid(),
      bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
      action_type text not null,
      actor_identity text not null,
      notes text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      constraint event_source_bundle_actions_action_type_check check (
        action_type in ('created')
      )
    );

    create or replace function public.atlas_assert_service_role()
    returns void
    language plpgsql
    stable
    security definer
    set search_path = ''
    as $$
    begin
      if session_user in ('postgres', 'service_role') then
        return;
      end if;
      raise exception 'service role required' using errcode = '42501';
    end;
    $$;

    revoke execute on function public.atlas_assert_service_role()
      from public, anon, authenticated;
  `);

  await db.exec(migration007);
  await db.exec(migration012);

  const legacyBundleId = await insertBundle();
  const legacyParent = await createDeterministic(legacyBundleId, 'a');
  assert.equal(legacyParent.status, 'generated');
  assert.equal(legacyParent.created, true);

  const legacyChild = await createEditorial(legacyParent.synthesis_id);
  assert.equal(await status(legacyParent.synthesis_id), 'superseded');
  await transition(legacyChild.synthesis_id, 'submit');
  await transition(legacyChild.synthesis_id, 'reject');
  assert.equal(await status(legacyParent.synthesis_id), 'superseded');

  const acceptedBundleId = await insertBundle();
  const acceptedBeforeMigration = await createDeterministic(acceptedBundleId, 'c');
  await transition(acceptedBeforeMigration.synthesis_id, 'submit');
  await transition(acceptedBeforeMigration.synthesis_id, 'accept');
  assert.equal(await status(acceptedBeforeMigration.synthesis_id), 'accepted');

  await db.exec(migration020);

  assert.equal(
    await status(legacyParent.synthesis_id),
    'generated',
    'migration 020 must restore a deterministic parent superseded only by a non-accepted editorial child',
  );
  assert.equal(
    await status(acceptedBeforeMigration.synthesis_id),
    'accepted',
    'migration 020 must not mutate an accepted synthesis',
  );
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_source_synthesis_actions
      where synthesis_id = $1::uuid
        and action_type = 'restored'
        and from_status = 'superseded'
        and to_status = 'generated'
    `, [legacyParent.synthesis_id])),
    1,
    'legacy repair must append a compensating audit action',
  );

  const bundleId = await insertBundle();
  const parent = await createDeterministic(bundleId, 'd');
  assert.equal(parent.status, 'generated');
  assert.equal(parent.created, true);

  const firstChild = await createEditorial(parent.synthesis_id, 'e');
  assert.equal(firstChild.status, 'generated');
  assert.equal(firstChild.created, true);
  assert.equal(
    await status(parent.synthesis_id),
    'generated',
    'editorial generation must leave its deterministic parent generated',
  );

  const activeReplay = await createEditorial(parent.synthesis_id, 'e');
  assert.equal(activeReplay.synthesis_id, firstChild.synthesis_id);
  assert.equal(activeReplay.created, false);

  await transition(firstChild.synthesis_id, 'submit');
  assert.equal(await status(firstChild.synthesis_id), 'in_review');
  assert.equal(
    await status(parent.synthesis_id),
    'generated',
    'editorial review submission must leave its deterministic parent generated',
  );

  await transition(firstChild.synthesis_id, 'reject');
  assert.equal(await status(firstChild.synthesis_id), 'rejected');
  assert.equal(
    await status(parent.synthesis_id),
    'generated',
    'editorial rejection must leave its deterministic parent generated and reusable',
  );

  const deterministicReplay = await createDeterministic(bundleId, 'd');
  assert.equal(deterministicReplay.synthesis_id, parent.synthesis_id);
  assert.equal(deterministicReplay.status, 'generated');
  assert.equal(deterministicReplay.created, false);

  const secondChild = await createEditorial(parent.synthesis_id, 'e');
  assert.notEqual(secondChild.synthesis_id, firstChild.synthesis_id);
  assert.equal(secondChild.version_number, 3);
  assert.equal(secondChild.status, 'generated');
  assert.equal(secondChild.created, true);
  assert.equal(await status(parent.synthesis_id), 'generated');

  await transition(secondChild.synthesis_id, 'submit');
  assert.equal(await status(parent.synthesis_id), 'generated');
  await transition(secondChild.synthesis_id, 'accept');

  assert.equal(await status(secondChild.synthesis_id), 'accepted');
  assert.equal(
    await status(parent.synthesis_id),
    'superseded',
    'only editorial acceptance may supersede the deterministic parent',
  );
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_source_syntheses
      where bundle_id = $1::uuid and status = 'accepted'
    `, [bundleId])),
    1,
    'the bundle must retain exactly one accepted synthesis',
  );
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_source_synthesis_actions
      where synthesis_id = $1::uuid
        and action_type = 'superseded'
        and notes = 'Superseded by its accepted editorial child.'
    `, [parent.synthesis_id])),
    1,
    'editorial acceptance must append the parent supersession audit action',
  );

  await assert.rejects(
    db.query(`
      insert into public.event_source_syntheses (
        bundle_id,
        version_number,
        status,
        engine_kind,
        engine_version,
        input_hash,
        reconciled_profile,
        conflicts,
        manifest_proposal,
        validation_report,
        is_manifest_valid,
        quality_score,
        model_provider,
        model_name,
        created_by
      ) values (
        $1::uuid,
        4,
        'accepted',
        'model_assisted',
        'accepted-uniqueness-test',
        $2::text,
        '{}'::jsonb,
        '[]'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        true,
        1,
        'test-provider',
        'test-model',
        'lifecycle-test'
      )
    `, [bundleId, 'f'.repeat(64)]),
    'the partial accepted index must reject a second accepted synthesis for the bundle',
  );

  for (const signature of [
    'public.atlas_create_model_assisted_synthesis(uuid,text,text,jsonb,jsonb,jsonb,jsonb,boolean,numeric,text,text,text,text)',
    'public.atlas_transition_event_source_synthesis(uuid,text,text,text)',
  ]) {
    assert.equal(
      await scalar(
        'select has_function_privilege($1::name, $2::regprocedure, $3::text)',
        ['anon', signature, 'EXECUTE'],
      ),
      false,
      `${signature} must not be executable by anon`,
    );
    assert.equal(
      await scalar(
        'select has_function_privilege($1::name, $2::regprocedure, $3::text)',
        ['authenticated', signature, 'EXECUTE'],
      ),
      false,
      `${signature} must not be executable by authenticated`,
    );
    assert.equal(
      await scalar(
        'select has_function_privilege($1::name, $2::regprocedure, $3::text)',
        ['service_role', signature, 'EXECUTE'],
      ),
      true,
      `${signature} must remain executable by service_role`,
    );
    const protection = await one(`
      select prosecdef, proconfig
      from pg_catalog.pg_proc
      where oid = $1::regprocedure
    `, [signature]);
    assert.equal(protection.prosecdef, true, `${signature} must remain SECURITY DEFINER`);
    assert(
      Array.isArray(protection.proconfig)
        && protection.proconfig.length === 1
        && /^search_path=(?:"")?$/.test(protection.proconfig[0]),
      `${signature} must retain an empty search path`,
    );
  }

  console.log('Event source synthesis lifecycle validations passed.');
} finally {
  await db.close();
}
