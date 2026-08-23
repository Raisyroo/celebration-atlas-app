import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
function read(file) { return readFileSync(path.join(root, file), 'utf8'); }
function walk(dir) { return readdirSync(path.join(root, dir)).flatMap((name) => { const rel = path.join(dir, name); const st = statSync(path.join(root, rel)); return st.isDirectory() ? walk(rel) : [rel]; }); }
function assert(condition, message) { if (!condition) failures.push(message); }

const clientFiles = walk('app').filter((file) => /\.(tsx?|jsx?)$/.test(file) && read(file).startsWith('"use client"'));
for (const file of clientFiles) assert(!read(file).includes('SUPABASE_SERVICE_ROLE_KEY'), `${file} references SUPABASE_SERVICE_ROLE_KEY`);

const loginForm = read('app/atlas-login/LoginForm.tsx');
const sameOriginIndex = loginForm.indexOf('/api/atlas-auth/request-link');
const approvedIndex = loginForm.indexOf('if (payload.ok)');
const browserClientIndex = loginForm.indexOf('createBrowserClient');
const signInWithOtpIndex = loginForm.indexOf('signInWithOtp');
const browserLinkIndex = loginForm.indexOf('requestBrowserMagicLink(email)');

assert(sameOriginIndex !== -1, 'LoginForm does not call the same-origin Atlas login endpoint');
assert(browserClientIndex !== -1, 'LoginForm does not create a browser Supabase client for PKCE magic links');
assert(signInWithOtpIndex !== -1, 'LoginForm does not call signInWithOtp in the browser');
assert(sameOriginIndex !== -1 && approvedIndex !== -1 && browserLinkIndex !== -1 && sameOriginIndex < approvedIndex && approvedIndex < browserLinkIndex, 'LoginForm must verify the admin allowlist before invoking browser Supabase sign-in');
assert(!/payload\.code\s*===\s*["']email_not_authorized["']\s*\)\s*{[\s\S]*requestBrowserMagicLink/.test(loginForm), 'LoginForm sends Supabase links for email_not_authorized');
assert(!/\bSUPABASE_SERVICE_ROLE_KEY\b/.test(loginForm), 'LoginForm references SUPABASE_SERVICE_ROLE_KEY');
assert(/NEXT_PUBLIC_SUPABASE_URL/.test(loginForm) && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(loginForm), 'LoginForm browser sign-in does not use only public Supabase credentials');
assert(loginForm.includes('emailRedirectTo: `${window.location.origin}/auth/callback`'), 'LoginForm magic links do not request the exact allowlisted callback path');

const homePage = read('app/page.tsx');
const authCallbackRecovery = read('components/AuthCallbackRecovery.tsx');
assert(homePage.includes('<AuthCallbackRecovery />'), 'Home page does not mount the misplaced auth-code recovery redirect');
assert(authCallbackRecovery.includes('new URL("/auth/callback"') && authCallbackRecovery.includes('window.location.replace'), 'Auth-code recovery does not forward misplaced Supabase callbacks');
assert(!authCallbackRecovery.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Auth-code recovery references SUPABASE_SERVICE_ROLE_KEY');

const atlasAuthRoute = read('app/api/atlas-auth/request-link/route.ts');
assert(atlasAuthRoute.includes('isAllowedAdminEmail'), 'Atlas auth route does not check the admin allowlist');
assert(!atlasAuthRoute.includes('signInWithOtp'), 'Atlas auth route should not request the PKCE Supabase magic link server-side');
assert(!atlasAuthRoute.includes('createServerClient'), 'Atlas auth route should not create a Supabase auth client for browser PKCE magic links');
assert(atlasAuthRoute.includes('Administrator email approved'), 'Atlas auth route should return an allowlist-approved response before browser sign-in');
assert(atlasAuthRoute.includes('crypto.randomUUID()'), 'Atlas auth route does not generate a request ID');
assert(atlasAuthRoute.includes('requestId'), 'Atlas auth route does not return a request ID on failures');
assert(!atlasAuthRoute.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Atlas auth route references SUPABASE_SERVICE_ROLE_KEY');

const authCallbackRoute = read('app/auth/callback/route.ts');
assert(authCallbackRoute.includes('exchangeCodeForSession'), 'Auth callback does not exchange Supabase code callbacks for a session');
assert(authCallbackRoute.includes('token_hash'), 'Auth callback does not read Supabase token_hash callbacks');
assert(authCallbackRoute.includes('verifyOtp'), 'Auth callback does not verify Supabase token_hash callbacks');
assert(authCallbackRoute.includes('signup'), 'Auth callback does not allow signup confirmation token callbacks');
assert(authCallbackRoute.includes('request.cookies.getAll()'), 'Auth callback should read cookies through NextRequest cookies for PKCE callbacks');
assert(authCallbackRoute.includes('supabase.auth.getUser()'), 'Auth callback should verify a readable user session before redirecting to Atlas Control');
assert(authCallbackRoute.includes('auth_error'), 'Auth callback should redirect failed sign-ins with a visible login error');
assert(authCallbackRoute.includes('Object.entries(headers)') && authCallbackRoute.includes('response.headers.set'), 'Auth callback does not apply Supabase no-cache headers when setting session cookies');

const auth = read('lib/atlas-control/auth.ts');
assert(auth.includes('request proxy persists refreshed sessions'), 'Server Component auth client does not tolerate read-only response cookies');
assert(auth.includes('hasLocalAtlasDevelopmentAccess') && auth.includes('process.env.NODE_ENV === "development"'), 'Local Atlas development access is not automatic');
assert(auth.includes('ATLAS_CONTROL_ACCESS_MAX_AGE') && auth.includes('24 * 180'), 'Direct operator access is not retained for the development period');

const proxy = read('proxy.ts');
const sessionRefresh = read('lib/atlas-control/session.ts');
assert(proxy.includes('refreshAtlasSession') && proxy.includes('/atlas-control/:path*') && proxy.includes('/api/atlas-control/:path*'), 'Atlas auth session proxy does not cover the protected page and APIs');
assert(sessionRefresh.includes('supabase.auth.getClaims()'), 'Atlas auth session proxy does not validate and refresh Supabase claims');
assert(sessionRefresh.includes('request.cookies.set') && sessionRefresh.includes('response.cookies.set'), 'Atlas auth session proxy does not synchronize refreshed cookies to the request and response');
assert(sessionRefresh.includes('Object.entries(headers)') && sessionRefresh.includes('response.headers.set'), 'Atlas auth session proxy does not apply Supabase no-cache headers');

const loginRoute = read('app/atlas-login/page.tsx');
assert(loginRoute.includes('searchParams') && loginRoute.includes('authError={params?.auth_error}'), 'Login page should pass auth callback error parameters to the form');
assert(loginRoute.includes('requireAtlasAdmin') && loginRoute.includes('redirect("/atlas-control")'), 'Authenticated operators should not be shown the login page again');
assert(loginForm.includes('authError?: string'), 'Login form should accept auth callback error parameters');
assert(loginForm.includes('session_exchange_failed') && loginForm.includes('session_missing'), 'Login form should explain callback session failures');
assert(loginForm.includes('window.location.hash') && loginForm.includes('otp_expired'), 'Login form should surface Supabase hash-only expired link errors');

for (const file of walk('app/api/atlas-control').filter((file) => file.endsWith('route.ts'))) {
  const source = read(file);
  assert(source.includes('requireAtlasAdmin'), `${file} does not independently require Atlas admin authorization`);
}

const intakeRoute = read('app/api/atlas-control/candidate-intake/route.ts');
const candidateIntake = read('lib/atlas-control/candidateIntake.ts');
assert(intakeRoute.includes('validateCandidateIntake'), 'candidate intake route does not validate payloads');
assert(intakeRoute.includes('idempotencyKey: parsed.value.idempotencyKey'), 'candidate intake route does not forward the idempotency key');
assert(!/\.from\([^)]*event_candidates/.test(intakeRoute), 'candidate intake route writes directly to event_candidates');
assert(candidateIntake.includes('const state = "Michigan"') && candidateIntake.includes('payload.eventKey ?? slugifyCandidate') && candidateIntake.includes('event_type: payload.eventType') && candidateIntake.includes('probable_recurrence: payload.recurrencePattern') && candidateIntake.includes('official_website_candidate: payload.sourceUrl'), 'candidate intake drops canonical state, event identity, recurrence, or official-source metadata');

const sourceInspectionRoute = read('app/api/atlas-control/event-source-inspection/route.ts');
assert(sourceInspectionRoute.includes('requireAtlasAdmin'), 'event source inspection route does not require Atlas admin authorization');
assert(sourceInspectionRoute.includes("runtime = 'nodejs'"), 'event source inspection route is not pinned to the Node runtime');
assert(sourceInspectionRoute.includes("'Cache-Control': 'private, no-store, max-age=0'"), 'event source inspection responses are cacheable');

const sourceInspection = read('lib/event-intake/officialSourceInspectionCore.ts');
assert(sourceInspection.includes('resolvePublicSourceTarget'), 'event source inspection does not enforce the public URL policy');
assert(sourceInspection.includes('hostname: address'), 'event source inspection does not pin requests to a validated address');
assert(sourceInspection.includes('MAX_DOWNLOAD_BYTES'), 'event source inspection has no response size limit');

const eventFactoryRoute = read('app/api/atlas-control/event-factory/route.ts');
const eventFactoryReadiness = read('lib/event-factory/readiness.ts');
assert(eventFactoryRoute.includes('requireAtlasAdmin'), 'event factory route does not require Atlas admin authorization');
assert(eventFactoryRoute.includes('getEventFactoryOverview'), 'event factory route does not use the server-owned readiness service');
assert(eventFactoryRoute.includes('private, no-store'), 'event factory readiness responses are cacheable');
for (const gate of ['exists', 'annual', 'dates', 'location', 'sources', 'map', 'page', 'art']) {
  assert(eventFactoryReadiness.includes(`${gate}:`), `event factory readiness is missing the ${gate} gate`);
}
assert(eventFactoryReadiness.includes('ANNUAL_LANGUAGE') && eventFactoryReadiness.includes('recurrenceGate'), 'event factory does not distinguish annual claims from confirmed recurrence');
assert(eventFactoryReadiness.includes('location_verified') && eventFactoryReadiness.includes('latitude !== null'), 'event factory does not require verified coordinates for location readiness');
assert(eventFactoryReadiness.includes('resolveExplicitEventThumbnail'), 'event factory does not reconcile existing Celebration Atlas art');
assert(eventFactoryReadiness.includes('event_verification_cases'), 'event factory readiness does not consume retained verification cases');
assert(eventFactoryReadiness.includes('event_factory_packages'), 'event factory readiness does not consume complete editorial packages');
assert(eventFactoryReadiness.includes('event_visual_workflows') && eventFactoryReadiness.includes('visualWorkflow?.status === "approved"'), 'event factory readiness does not require approved visual workflows for new art');
assert(eventFactoryReadiness.includes('event_page_versions_event_page_id_fkey'), 'event factory readiness does not disambiguate the Event Page version relationship');

const eventFactoryPackages = read('lib/event-factory/packages.ts');
for (const rpc of ['atlas_upsert_event_factory_package', 'atlas_finalize_art_optional_event_factory_package', 'atlas_create_event_factory_hero_correction', 'atlas_create_event_factory_art_revision', 'atlas_review_event_factory_package', 'atlas_materialize_event_factory_package', 'atlas_activate_event_factory_publication', 'atlas_finish_event_factory_publication', 'atlas_list_event_factory_packages']) {
  assert(eventFactoryPackages.includes(`"${rpc}"`), `event package service does not call fixed RPC ${rpc}`);
}
assert(eventFactoryPackages.includes('validateEventPageManifest'), 'event package publication does not revalidate the reviewed Event Hub manifest');
assert(eventFactoryPackages.includes('Remove event sponsor references'), 'event package preparation does not reject sponsor references');
assert(eventFactoryPackages.includes('item.status === "accepted"') && eventFactoryPackages.includes('validateEventPageManifest(item.manifest_proposal)'), 'event package preparation does not prefer a strictly valid accepted source synthesis');
assert(eventFactoryPackages.includes('item.status === "generated"') && eventFactoryPackages.includes('validateEventPageContentReadiness(item.manifest_proposal)') && eventFactoryPackages.includes('content.artPending'), 'event package preparation does not permit a source-bound generated proposal for private art-pending review');
assert(eventFactoryPackages.includes('manifest_proposal'), 'event package preparation cannot consume a retained synthesis manifest');
assert(eventFactoryPackages.includes('location_verified'), 'event package preparation cannot consume verified canonical coordinates');
assert(eventFactoryPackages.includes('getApprovedEventVisualWorkflow'), 'event package preparation does not consume approved visual workflows');
assert(eventFactoryPackages.includes('visual-signature-v1') && eventFactoryPackages.includes('assertReviewedVisualAsset'), 'event package publication does not retain and recheck the approved visual workflow');
assert(!eventFactoryPackages.includes('publishEventPageVersion'), 'event package service still activates the Event Hub before atomic package finalization');
assert(
  eventFactoryPackages.indexOf('const versionId = await prepareReviewedManifest(') < eventFactoryPackages.indexOf('const mediaId = validation.artPending')
    && eventFactoryPackages.indexOf('const mediaId = validation.artPending') < eventFactoryPackages.indexOf('const activated = await activateEventFactoryPublication(')
    && eventFactoryPackages.includes('? null')
    && eventFactoryPackages.includes(': await registerApprovedPackageArt('),
  'event package publication does not prepare page, conditionally register media, and activate in order',
);
assert(!eventFactoryPackages.includes('window'), 'server-owned event package service references the browser');
assert(!/rpc\([^"'`]/.test(eventFactoryPackages), 'event package service appears to accept a dynamic RPC name');

const publishedAtlasEvents = read('lib/events/publishedAtlasEvents.ts');
const atlasHomePage = read('app/page.tsx');
const michiganAtlasExperience = read('components/MichiganAtlasExperience.tsx');
const homeAtlasExperience = read('components/HomeAtlasExperience.tsx');
const atlasMap = read('components/AtlasMap.tsx');
assert(publishedAtlasEvents.includes("rpc('atlas_get_published_event_discovery'"), 'public map catalog does not use the batched publication-gated discovery RPC');
assert((publishedAtlasEvents.match(/\.rpc\(/g) ?? []).length === 1 && !publishedAtlasEvents.includes('.from('), 'public map catalog performs more than one database request');
assert(!atlasHomePage.includes('resolveEventFlyerMediaMapServer'), 'home page still resolves media separately for every event');
assert(atlasHomePage.includes('await connection()'), 'home page published discovery can become a stale prerender');
assert(atlasHomePage.includes('resolvePublishedAtlasEvents(MICHIGAN_STATE_ATLAS_CONFIG)') && atlasHomePage.includes('<MichiganAtlasExperience events={events}'), 'home page does not resolve and supply the explicit Michigan catalog');
assert(michiganAtlasExperience.includes('stateConfig={MICHIGAN_STATE_ATLAS_CONFIG}') && michiganAtlasExperience.includes('events={events}'), 'Michigan atlas wrapper does not bind the Michigan state configuration and supplied catalog');
assert(homeAtlasExperience.includes('stateConfig: StateAtlasConfig') && homeAtlasExperience.includes('events: readonly AtlasEvent[]') && homeAtlasExperience.includes('stateConfig={stateConfig}') && homeAtlasExperience.includes('events={events}'), 'state atlas experience does not require and forward explicit state data');
assert(atlasMap.includes('stateConfig: StateAtlasConfig') && atlasMap.includes('events: readonly AtlasEvent[]') && atlasMap.includes('resolveAtlasMarkerLayouts(events'), 'AtlasMap does not require and use the supplied state catalog');
assert(!atlasMap.includes('events = ATLAS_EVENTS'), 'AtlasMap silently falls back to the global Michigan catalog');

const eventVerificationRoute = read('app/api/atlas-control/event-verifications/route.ts');
const eventVerificationService = read('lib/event-factory/verification.ts');
assert(eventVerificationRoute.includes('requireAtlasAdmin'), 'event verification route does not require Atlas admin authorization');
assert(eventVerificationRoute.includes('private, no-store'), 'event verification responses are cacheable');
for (const rpc of ['atlas_create_event_verification_case', 'atlas_add_event_verification_evidence', 'atlas_transition_event_verification_case', 'atlas_list_event_verification_cases']) {
  assert(eventVerificationService.includes(`"${rpc}"`), `event verification service does not call fixed RPC ${rpc}`);
}
assert(!/rpc\([^"'`]/.test(eventVerificationService), 'event verification service appears to accept a dynamic RPC name');

const eventVerificationMigration = read('supabase/migrations/008_event_factory_verification.sql');
for (const table of ['event_verification_cases', 'event_verification_evidence', 'event_verification_actions']) {
  assert(eventVerificationMigration.includes(`alter table public.${table} enable row level security`), `event verification migration does not enable RLS for ${table}`);
  assert(eventVerificationMigration.includes(`revoke all on table public.${table}`), `event verification migration does not revoke direct access for ${table}`);
}
assert(eventVerificationMigration.includes("proof_kind = 'annual_language'") && eventVerificationMigration.includes('v_occurrence_count >= 2'), 'event verification cannot prove annual recurrence from official language or multiple years');
assert(eventVerificationMigration.includes("set search_path = ''"), 'event verification RPCs do not use a fixed empty search path');
assert(eventVerificationMigration.includes('revoke all on function public.atlas_add_event_verification_evidence'), 'event verification evidence RPC is not revoked from public roles');

const officialFirstVerificationMigration = read('supabase/migrations/029_official_first_event_verification.sql');
assert(/(?:^|\r?\n)begin;\r?\n/.test(officialFirstVerificationMigration), 'official-first verification migration is not atomic');
assert(officialFirstVerificationMigration.trimEnd().endsWith('commit;'), 'official-first verification migration does not commit atomically');
assert(!/\bcreate\s+table\b/i.test(officialFirstVerificationMigration), 'official-first verification migration adds a duplicate table');
for (const rpc of ['atlas_add_event_verification_evidence', 'atlas_transition_event_verification_case', 'atlas_upsert_event_factory_package']) {
  assert(officialFirstVerificationMigration.includes(`create or replace function public.${rpc}`), `official-first verification migration does not replace ${rpc}`);
  assert(officialFirstVerificationMigration.includes(`grant execute on function public.${rpc}`), `official-first verification migration does not grant ${rpc} only through the service contract`);
}
assert((officialFirstVerificationMigration.match(/perform public\.atlas_assert_service_role\(\);/g) ?? []).length === 3, 'official-first verification RPCs are not all service-role asserted');
assert(officialFirstVerificationMigration.includes("or v_case.dates_status <> 'announced'"), 'official-first verification can clear a case without current dates');
assert(!officialFirstVerificationMigration.includes('or v_case.supporting_source_count < 1'), 'official-first verification still requires a supporting source');
assert(officialFirstVerificationMigration.includes("'sources', v_case.official_source_count >= 1,"), 'private package readiness still requires a supporting source');
assert(officialFirstVerificationMigration.includes("'refreshed'"), 'retained evidence cannot be monotonically reclassified as official');
assert(!/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:events|event_pages|event_page_versions|event_media)\b/i.test(officialFirstVerificationMigration), 'official-first verification migration can mutate public event state');

const serviceRoleCompatibilityMigration = read('supabase/migrations/009_fix_atlas_service_role_assertion.sql');
assert(serviceRoleCompatibilityMigration.includes("request.jwt.claims") && serviceRoleCompatibilityMigration.includes("->>'role'"), 'control-plane role assertion does not support current PostgREST JWT claims');
assert(serviceRoleCompatibilityMigration.includes('revoke execute on function public.atlas_assert_service_role()'), 'control-plane role assertion is executable by public roles');

const candidateIntakeCompatibilityMigration = read('supabase/migrations/010_fix_atlas_candidate_intake.sql');
assert(candidateIntakeCompatibilityMigration.includes('jsonb_agg') && candidateIntakeCompatibilityMigration.includes('public.discovery_runs'), 'candidate intake does not write JSON source URLs with a discovery-run owner');
assert(candidateIntakeCompatibilityMigration.includes("set search_path = ''"), 'candidate intake compatibility RPC does not use a fixed empty search path');
assert(candidateIntakeCompatibilityMigration.includes('revoke execute on function public.atlas_intake_event_candidate'), 'candidate intake RPC is not revoked from public roles');

const eventPackageMigration = read('supabase/migrations/011_event_factory_packages.sql');
for (const table of ['event_factory_packages', 'event_factory_package_actions']) {
  assert(eventPackageMigration.includes(`alter table public.${table} enable row level security`), `event package migration does not enable RLS for ${table}`);
  assert(eventPackageMigration.includes(`revoke all on table public.${table}`), `event package migration does not revoke direct access for ${table}`);
}
assert(eventPackageMigration.includes("status in ('assembling', 'ready_for_review', 'approved'"), 'event packages do not retain a private review lifecycle');
assert(eventPackageMigration.includes('Event sponsor references are not allowed'), 'event package migration does not reject sponsor references');
assert(eventPackageMigration.includes('A verified candidate case is required before package assembly.'), 'event package assembly does not require retained verification');
assert(eventPackageMigration.includes('A published Event Hub version is required.'), 'event package publication can finish without a published page');
assert(eventPackageMigration.includes("set search_path = ''"), 'event package RPCs do not use a fixed empty search path');
assert(eventPackageMigration.includes('revoke all on function public.atlas_materialize_event_factory_package'), 'event package materialization RPC is not revoked from public roles');

const atomicEventPackageMigration = read('supabase/migrations/021_atomic_event_factory_publication.sql');
assert(atomicEventPackageMigration.includes('atlas_activate_event_factory_publication'), 'atomic Event Factory activation RPC is missing');
assert(atomicEventPackageMigration.includes('for update'), 'atomic Event Factory activation does not lock publication records');
assert(atomicEventPackageMigration.includes("v_version.manifest is distinct from v_package.page_manifest"), 'atomic Event Factory activation does not bind the exact frozen manifest');
assert(atomicEventPackageMigration.includes("v_media.status <> 'approved'"), 'atomic Event Factory activation does not require approved media');
assert(atomicEventPackageMigration.includes("v_package.status = 'published'"), 'atomic Event Factory activation has no idempotent published replay path');
assert(atomicEventPackageMigration.includes('previous_event_page_version_id'), 'atomic Event Factory activation does not audit the replaced page version');
assert(atomicEventPackageMigration.includes('Successful publication requires the atomic Event Factory activation RPC.'), 'legacy package finalization can still report non-atomic success');
assert(atomicEventPackageMigration.includes('atlas_guard_event_factory_page_activation'), 'independent Event Page publication is not guarded for factory manifests');
assert(atomicEventPackageMigration.includes("set search_path = ''"), 'atomic Event Factory publication RPCs do not use a fixed empty search path');
assert(atomicEventPackageMigration.includes('from public, anon, authenticated'), 'atomic Event Factory publication RPCs are not revoked from browser roles');

const publishedDiscoveryMigration = read('supabase/migrations/022_batched_published_atlas_discovery.sql');
assert(publishedDiscoveryMigration.includes('atlas_get_published_event_discovery'), 'batched published discovery RPC is missing');
assert(publishedDiscoveryMigration.includes("package.status = 'published'") && publishedDiscoveryMigration.includes("version.status = 'published'"), 'batched discovery does not require published package and Event Hub state');
assert(publishedDiscoveryMigration.includes('version.manifest = package.page_manifest'), 'batched discovery does not bind the exact frozen package manifest');
assert(publishedDiscoveryMigration.includes("event.status = 'active'") && publishedDiscoveryMigration.includes("event.verification_status = 'verified'"), 'batched discovery does not require a public canonical event');
assert(publishedDiscoveryMigration.includes("set search_path = ''"), 'batched published discovery RPC does not use a fixed empty search path');
assert(publishedDiscoveryMigration.includes('from public, anon, authenticated'), 'batched published discovery RPC is not revoked from browser roles');

const visualWorkflowMigration = read('supabase/migrations/014_event_visual_workflows.sql');
for (const table of ['event_visual_workflows', 'event_visual_workflow_actions']) {
  assert(visualWorkflowMigration.includes(`alter table public.${table} enable row level security`), `visual workflow migration does not enable RLS for ${table}`);
  assert(visualWorkflowMigration.includes(`revoke all on table public.${table}`), `visual workflow migration does not revoke direct access for ${table}`);
}
assert(visualWorkflowMigration.includes("'celebration-atlas-media'") && visualWorkflowMigration.includes('public = true'), 'visual workflow migration does not provide public cloud hero storage');
assert(visualWorkflowMigration.includes('p_reviewed_thumbnail_count between 15 and 30'), 'fast visual workflows do not retain the 15-30 thumbnail review gate');
assert(visualWorkflowMigration.includes('v_motif_count between 3 and 5'), 'fast visual workflows do not enforce a three-to-five element visual signature');
for (const check of ['visualElementsVerified', 'independentComposition', 'noInventedTextOrMarks', 'mobileCropVerified', 'publicAssetVerified']) {
  assert(visualWorkflowMigration.includes(check), `visual workflow approval is missing ${check}`);
}
assert(visualWorkflowMigration.includes("set search_path = ''"), 'visual workflow RPCs do not use a fixed empty search path');

const eventFactoryRevisionMigration = read('supabase/migrations/017_event_factory_revisions.sql');
assert(eventFactoryRevisionMigration.includes('revision_number'), 'event factory revisions do not version visual workflows');
assert(eventFactoryRevisionMigration.includes('supersedes_workflow_id'), 'event factory revisions do not retain prior visual workflow provenance');
assert(eventFactoryRevisionMigration.includes('supersedes_package_id'), 'event factory revisions do not retain prior package provenance');
assert(eventFactoryRevisionMigration.includes('atlas_create_event_visual_workflow_revision'), 'event factory revisions do not expose the guarded visual correction operation');
assert(eventFactoryRevisionMigration.includes('workflow.supersedes_workflow_id is null'), 'base visual upserts are not isolated from correction revisions');
assert(eventFactoryRevisionMigration.includes('package.supersedes_package_id is null'), 'base package upserts are not isolated from correction revisions');
assert(eventFactoryRevisionMigration.includes('Hero corrections must start from the latest published package.'), 'hero corrections can fork stale published packages');
assert(eventFactoryRevisionMigration.includes('atlas_guard_frozen_visual_workflow'), 'frozen package visuals can still be reopened');
assert(eventFactoryRevisionMigration.includes("set search_path = ''"), 'event factory revision RPCs do not use a fixed empty search path');
assert(eventFactoryRevisionMigration.includes('from public, anon, authenticated'), 'event factory revision RPCs are not revoked from browser roles');
assert(visualWorkflowMigration.includes('revoke all on function public.atlas_review_event_visual_workflow'), 'visual workflow review RPC is not revoked from public roles');

const visualWorkflowService = read('lib/event-factory/visuals.ts');
for (const rpc of ['atlas_upsert_event_visual_workflow', 'atlas_create_event_visual_workflow_revision', 'atlas_attach_event_visual_revision_asset', 'atlas_update_event_visual_revision_qa', 'atlas_review_event_visual_workflow', 'atlas_list_event_visual_workflows']) {
  assert(visualWorkflowService.includes(`"${rpc}"`), `visual workflow service does not call fixed RPC ${rpc}`);
}
assert(!/rpc\([^"'`]/.test(visualWorkflowService), 'visual workflow service appears to accept a dynamic RPC name');
assert(visualWorkflowService.includes('sourceByteSize') && visualWorkflowService.includes('optimization?.strategy === "webp"'), 'visual workflow reads discard retained optimization provenance');
const visualPrompt = read('lib/event-factory/visualPrompt.ts');
assert(visualPrompt.includes('text-free cinematic Celebration Atlas hero image'), 'visual workflow does not create the retained Celebration Atlas generation prompt');
assert(visualPrompt.includes('original composition') && visualPrompt.includes('compact mobile hero crop'), 'visual generation prompt does not protect composition independence and mobile framing');

const visualWorkflowRoute = read('app/api/atlas-control/event-visuals/route.ts');
const visualUploadRoute = read('app/api/atlas-control/event-visuals/upload/route.ts');
assert(visualWorkflowRoute.includes('requireAtlasAdmin') && visualWorkflowRoute.includes('private, no-store'), 'visual workflow API is not protected and non-cacheable');
assert(visualUploadRoute.includes('requireAtlasAdmin') && visualUploadRoute.includes('CELEBRATION_ATLAS_MEDIA_BUCKET'), 'hero upload does not use the protected Atlas media bridge');
assert(visualUploadRoute.includes('method: "HEAD"') && visualUploadRoute.includes('publicAssetVerified: true'), 'hero upload does not verify the public asset before advancing readiness');
assert(visualUploadRoute.includes('optimizeEventHeroUpload') && visualUploadRoute.includes('cacheControl: hero.cacheControl'), 'hero upload does not optimize delivery bytes and apply long-lived caching');
assert(visualUploadRoute.includes('sourceByteSize') && visualUploadRoute.includes('savingsPercent'), 'hero upload does not retain optimization provenance');

const sourceBundleRoute = read('app/api/atlas-control/source-bundles/route.ts');
assert(sourceBundleRoute.includes('requireAtlasAdmin'), 'source bundle route does not require Atlas admin authorization');
assert(sourceBundleRoute.includes("runtime = 'nodejs'"), 'source bundle route is not pinned to the Node runtime');
assert(sourceBundleRoute.includes("'Cache-Control': 'private, no-store, max-age=0'"), 'source bundle responses are cacheable');
assert(sourceBundleRoute.includes("action === 'create_and_collect'"), 'source bundle route does not expose bounded official-page collection');
assert(sourceBundleRoute.includes('includeEventIdentity: optionalBoolean(payload.includeEventIdentity)'), 'source bundle route cannot explicitly retain event identity from a supporting source');
assert(sourceBundleRoute.includes('includeEventLocation: optionalBoolean(payload.includeEventLocation)'), 'source bundle route cannot explicitly retain event location from a supporting source');

const sourceSynthesisRoute = read('app/api/atlas-control/source-syntheses/route.ts');
assert(sourceSynthesisRoute.includes("action === 'attach_map'"), 'source synthesis route does not expose sourced map attachment');
assert(sourceSynthesisRoute.includes('attachEventSourceSynthesisMapRecord'), 'source synthesis route bypasses the audited map-record operation');
assert(sourceSynthesisRoute.includes("new URL(sourceUrl).protocol !== 'https:'"), 'source synthesis route accepts map provenance without an HTTPS source');

const sourceBundles = read('lib/event-intake/sourceBundles.ts');
for (const rpc of ['atlas_create_event_source_bundle', 'atlas_add_event_source_snapshot', 'atlas_transition_event_source_bundle', 'atlas_attach_event_source_bundle_candidate', 'atlas_list_event_source_bundles']) {
  assert(sourceBundles.includes(`'${rpc}'`), `source bundle service does not call fixed RPC ${rpc}`);
}
assert(sourceBundles.includes("EVENT_SOURCE_ARCHIVE_BUCKET = 'event-source-archive'"), 'source bundle service does not use the private source archive');
assert(sourceBundles.includes('gzipSync'), 'source bundle service does not compress raw source archives');
assert(sourceBundles.includes('selectBoundedOfficialSourceLinks'), 'source bundle service does not select related official-page evidence');
assert(!/rpc\([^"'`]/.test(sourceBundles), 'source bundle service appears to accept a dynamic RPC name');

const sourceCollection = read('lib/event-intake/sourceCollection.ts');
assert(sourceCollection.includes('sameOfficialSite'), 'official source collection does not enforce a same-site policy');
assert(sourceCollection.includes('Number.POSITIVE_INFINITY'), 'default official source collection still imposes an editorial page-count cap');
assert(sourceCollection.includes('editorialPriority'), 'official source collection does not prioritize editorial evidence');

const sourceIntelligenceMigration = read('supabase/migrations/006_event_source_intelligence.sql');
assert(sourceIntelligenceMigration.includes("'event-source-archive'") && sourceIntelligenceMigration.includes('false,'), 'source intelligence migration does not create a private archive bucket');
for (const table of ['event_source_bundles', 'event_source_snapshots', 'event_source_claims', 'event_source_links', 'event_schedule_candidates', 'event_source_bundle_actions']) {
  assert(sourceIntelligenceMigration.includes(`alter table public.${table} enable row level security`), `source intelligence migration does not enable RLS for ${table}`);
  assert(sourceIntelligenceMigration.includes(`revoke all on table public.${table}`), `source intelligence migration does not revoke direct access for ${table}`);
}
assert(sourceIntelligenceMigration.includes("set search_path = ''"), 'source intelligence RPCs do not use a fixed empty search path');
assert(sourceIntelligenceMigration.includes('revoke all on function public.atlas_add_event_source_snapshot'), 'source snapshot RPC is not revoked from public roles');

const synthesisRoute = read('app/api/atlas-control/source-syntheses/route.ts');
assert(synthesisRoute.includes('requireAtlasAdmin'), 'source synthesis route does not require Atlas admin authorization');
assert(synthesisRoute.includes("runtime = 'nodejs'"), 'source synthesis route is not pinned to the Node runtime');
assert(synthesisRoute.includes("'Cache-Control': 'private, no-store, max-age=0'"), 'source synthesis responses are cacheable');

const synthesisService = read('lib/event-intake/synthesis.ts');
for (const rpc of ['atlas_create_event_source_synthesis', 'atlas_create_model_assisted_synthesis', 'atlas_transition_event_source_synthesis', 'atlas_list_event_source_syntheses']) {
  assert(synthesisService.includes(`'${rpc}'`), `source synthesis service does not call fixed RPC ${rpc}`);
}
assert(!/rpc\([^"'`]/.test(synthesisService), 'source synthesis service appears to accept a dynamic RPC name');
assert(!synthesisService.includes('publishEventPageVersion'), 'source synthesis service can publish an Event Hub version directly');
assert(synthesisService.includes('inspectionContentSegments'), 'source synthesis does not load archived editorial content segments');
assert(synthesisService.includes('generateModelAssistedEditorialSynthesis'), 'source synthesis cannot create a review-gated editorial proposal');
assert(synthesisService.includes('getEventSourceSynthesisPreview'), 'source synthesis does not expose a private validated preview reader');

const synthesisPreviewPage = read('app/atlas-control/synthesis-preview/[synthesisId]/page.tsx');
assert(synthesisPreviewPage.includes('requireAtlasAdmin'), 'synthesis preview is not protected by Atlas admin authorization');
assert(
  synthesisPreviewPage.includes('getEventSourceSynthesisPreview') &&
    synthesisPreviewPage.includes('manifest={preview.manifest}') &&
    synthesisPreviewPage.includes('scoutContentReference={preview.scoutContentReference}'),
  'synthesis preview does not render the exact reviewed Event Hub manifest and Scout context',
);
assert(synthesisPreviewPage.includes('index: false') && synthesisPreviewPage.includes('follow: false'), 'synthesis preview is not excluded from search indexing');
assert(
  synthesisPreviewPage.includes("homeLink={{ href: '/atlas-control', label: 'Atlas Control' }}"),
  'synthesis preview does not return authors to Atlas Control',
);

const privatePackagePreview = read('app/atlas-control/event-preview/[packageId]/page.tsx');
assert(privatePackagePreview.includes('requireAtlasAdmin'), 'private package preview is not protected by Atlas admin authorization');
assert(
  privatePackagePreview.includes('getEventFactoryCombinedReview') && privatePackagePreview.includes('EventReviewDesk'),
  'private package preview does not load the combined page-and-hero review surface',
);

const combinedEventReview = read('app/atlas-control/event-preview/[packageId]/EventReviewDesk.tsx');
assert(combinedEventReview.includes('Approve content + layout'), 'combined review does not expose an independent page decision');
assert(combinedEventReview.includes('Approve hero'), 'combined review does not expose an independent hero decision');
assert(combinedEventReview.includes('No publication on this screen') || combinedEventReview.includes('nothing was published'), 'combined review does not preserve the publication boundary');
assert(combinedEventReview.includes("action: 'prepare'"), 'approved hero is not attached back to the private package');

const controlDesk = read('app/atlas-control/ControlDesk.tsx');
assert(controlDesk.includes('/atlas-control/synthesis-preview/${synthesis.id}'), 'Atlas Control does not link valid synthesis proposals to their private Event Hub preview');
assert(controlDesk.includes('/atlas-control/event-preview/${item.packageId}'), 'Atlas Control does not link packages to the combined private review surface');
assert(controlDesk.includes('publish_reviewed') && !controlDesk.includes('Approve and publish'), 'Atlas Control still couples review approval to publication');
assert(controlDesk.includes('Visual signature workflow') && controlDesk.includes('Save visual brief') && controlDesk.includes('Approve visual'), 'Atlas Control does not expose the visual-signature review workflow');

const publicPackagePreview = read('app/event-preview/[packageId]/page.tsx');
assert(publicPackagePreview.includes('getPublicEventFactoryPackagePreview'), 'Public package review does not use the status-gated package reader');
assert(
  publicPackagePreview.includes('manifest={preview.manifest}') &&
    publicPackagePreview.includes('scoutContentReference={preview.scoutContentReference}'),
  'Public package review does not render the exact Event Hub manifest and Scout context',
);
assert(!publicPackagePreview.includes('requireAtlasAdmin'), 'Read-only package review is still blocked by administrator authentication');
assert(!publicPackagePreview.includes('homeLink='), 'Public package review overrides the public Atlas-home destination');
assert(publicPackagePreview.includes('index: false') && publicPackagePreview.includes('follow: false'), 'Read-only package review is not excluded from search indexing');

assert(eventFactoryPackages.includes('PUBLIC_PREVIEW_STATUSES') && eventFactoryPackages.includes('ready_for_review'), 'Public package review is not restricted to reviewable lifecycle states');

const dynamicSchedule = read('lib/event-intake/dynamicSchedule.ts');
assert(dynamicSchedule.includes('saffire-events-service-v1'), 'official dynamic calendar collection is missing its audited adapter identity');
assert(dynamicSchedule.includes('resolvePublicSourceTarget'), 'dynamic calendar collection bypasses the public-source network policy');
assert(dynamicSchedule.includes('MAX_SCHEDULE_ITEMS'), 'dynamic calendar collection has no bounded item limit');
assert(dynamicSchedule.includes('cleanVenue') && dynamicSchedule.includes('editionRanges'), 'dynamic schedule normalization does not remove branded venues and stale edition copy');

const editorialAssistance = read('lib/event-intake/editorialAssistance.ts');
assert(editorialAssistance.includes('immutableManifestProjection'), 'model editorial assistance does not lock factual manifest fields');
assert(editorialAssistance.includes('numericTokens'), 'model editorial assistance does not verify numeric claims');
assert(editorialAssistance.includes('sourceSnapshotIds'), 'model editorial assistance does not require source provenance');
assert(editorialAssistance.includes('SPONSOR_LANGUAGE'), 'model editorial assistance does not reject sponsor language');

const editorialModel = read('lib/event-intake/editorialModel.ts');
assert(editorialModel.includes('getVercelOidcToken'), 'AI Gateway editorial calls do not use the Vercel runtime OIDC token');
assert(editorialModel.includes("type: 'json_schema'"), 'AI editorial output is not constrained by a JSON schema');
assert(editorialModel.includes('Detroit Jazz Festival Why Go'), 'Ultra authorship does not use Detroit Jazz Why Go as the value-density golden master');
assert(editorialModel.includes('task-specific deep links'), 'Ultra authorship does not preserve useful Plan deep links');

const combinedReviewDesk = read('app/atlas-control/event-preview/[packageId]/EventReviewDesk.tsx');
const proposedPhonePreview = read('app/atlas-control/event-preview/[packageId]/phone/page.tsx');
assert(combinedReviewDesk.includes('/atlas-control/event-preview/${review.package.id}/phone'), 'combined review does not use the authenticated proposed phone preview');
assert(proposedPhonePreview.includes('ready_for_review') && proposedPhonePreview.includes('asset.publicUrl'), 'proposed phone preview does not show a pending review asset inside the Event Hub');
assert(proposedPhonePreview.includes('requireAtlasAdmin'), 'provisional visual preview is not restricted to Atlas Control administrators');

const editorialPlanning = read('lib/event-intake/editorialPlanning.ts');
assert(editorialPlanning.includes('current_pending_with_reference'), 'editorial planning does not separate a pending current program from historical reference');
assert(editorialPlanning.includes('referenceSchedule'), 'editorial planning does not build a historical reference schedule');
assert(editorialPlanning.includes('traditions'), 'editorial planning does not derive tradition candidates');
assert(editorialPlanning.includes('currentScheduleProtected'), 'editorial planning does not retain the current-year schedule protection check');
assert(editorialPlanning.includes('cherry queen') && editorialPlanning.includes('festival-parades'), 'editorial planning does not cover general festival royalty and parade traditions');

const synthesisEngine = read('lib/event-intake/synthesisEngine.ts');
assert(synthesisEngine.includes("DETERMINISTIC_SYNTHESIS_ENGINE_VERSION = 'deterministic-v25-evidence-time-lifecycle'"), 'the evidence-time lifecycle synthesis engine version was not advanced');
assert(synthesisEngine.includes('applyEditorialPlan'), 'source synthesis does not compose the editorial plan into Event Hub proposals');
assert(synthesisEngine.includes("candidate.startsAt?.startsWith(`${editionYear}-`)"), 'source synthesis does not filter dated items to the current edition year');
assert(
  synthesisEngine.includes('scout-family')
    && synthesisEngine.includes('scout-best-music')
    && synthesisEngine.includes('scout-grandstand')
    && synthesisEngine.includes('scout-livestock'),
  'current schedule synthesis does not create source-bound Scout filters',
);

const synthesisMigration = read('supabase/migrations/007_event_source_synthesis.sql');
for (const table of ['event_source_syntheses', 'event_source_synthesis_actions']) {
  assert(synthesisMigration.includes(`alter table public.${table} enable row level security`), `source synthesis migration does not enable RLS for ${table}`);
  assert(synthesisMigration.includes(`revoke all on table public.${table}`), `source synthesis migration does not revoke direct access for ${table}`);
}
assert(synthesisMigration.includes("set search_path = ''"), 'source synthesis RPCs do not use a fixed empty search path');
assert(synthesisMigration.includes('revoke all on function public.atlas_create_event_source_synthesis'), 'source synthesis creation RPC is not revoked from public roles');
assert(!synthesisMigration.includes('atlas_publish_event_page_version'), 'source synthesis migration can publish an Event Hub version directly');

const modelSynthesisMigration = read('supabase/migrations/012_model_assisted_editorial_synthesis.sql');
assert(modelSynthesisMigration.includes("set search_path = ''"), 'model-assisted synthesis RPC does not use a fixed empty search path');
assert(modelSynthesisMigration.includes('parent_synthesis_id'), 'model-assisted synthesis does not retain its deterministic parent');
assert(modelSynthesisMigration.includes('revoke all on function public.atlas_create_model_assisted_synthesis'), 'model-assisted synthesis RPC is exposed to public roles');
assert(!modelSynthesisMigration.includes('atlas_publish_event_page_version'), 'model-assisted synthesis can publish an Event Hub version directly');

const synthesisLifecycleMigration = read('supabase/migrations/020_preserve_deterministic_editorial_parent.sql');
assert(synthesisLifecycleMigration.includes("and synthesis.status <> 'rejected'"), 'rejected editorial synthesis replay still blocks a replacement child');
assert(synthesisLifecycleMigration.includes("v_parent_status in ('generated', 'in_review')"), 'editorial acceptance does not supersede its deterministic parent');
assert(synthesisLifecycleMigration.includes("'restored'"), 'prematurely superseded deterministic parents do not receive a compensating audit action');
assert(
  synthesisMigration.includes('event_source_syntheses_one_accepted_per_bundle')
    && !synthesisLifecycleMigration.includes('drop index event_source_syntheses_one_accepted_per_bundle'),
  'migration 020 does not preserve accepted-synthesis uniqueness',
);
assert(synthesisLifecycleMigration.includes('perform public.atlas_assert_service_role()'), 'corrected synthesis RPCs are not restricted to service-role execution');
assert(synthesisLifecycleMigration.includes("set search_path = ''"), 'corrected synthesis RPCs do not use a fixed empty search path');
for (const rpc of ['atlas_create_model_assisted_synthesis', 'atlas_transition_event_source_synthesis']) {
  assert(synthesisLifecycleMigration.includes(`revoke all on function public.${rpc}`), `corrected synthesis RPC ${rpc} is exposed to public roles`);
  assert(synthesisLifecycleMigration.includes(`grant execute on function public.${rpc}`), `corrected synthesis RPC ${rpc} is unavailable to the service role`);
}
assert(!synthesisLifecycleMigration.includes('atlas_publish_event_page_version'), 'corrected synthesis lifecycle can publish an Event Hub version directly');

const synthesisMapMigration = read('supabase/migrations/013_source_synthesis_map_record.sql');
assert(synthesisMapMigration.includes('atlas_attach_source_synthesis_map_record'), 'map provenance migration does not expose the guarded attachment RPC');
assert(synthesisMapMigration.includes("v_status <> 'generated'"), 'map provenance can be attached after synthesis review has begun');
assert(synthesisMapMigration.includes('atlas_assert_service_role'), 'map provenance RPC is not restricted to the service role');

const service = read('lib/atlas-control/service.ts');
assert(service.includes('"atlas_intake_event_candidate"'), 'service does not call the typed atlas_intake_event_candidate RPC');
assert(!/rpc\([^"'`]/.test(service), 'service appears to accept a dynamic RPC name');

const eventPageRoute = read('app/api/atlas-control/event-pages/route.ts');
assert(eventPageRoute.includes('requireAtlasAdmin'), 'event page publishing route does not require Atlas admin authorization');
assert(eventPageRoute.includes('createEventPageDraft') && eventPageRoute.includes('publishEventPageVersion'), 'event page publishing route does not use the fixed publishing service');
assert(!/\.from\([^)]*event_page_versions[^)]*\)\s*\.insert/.test(eventPageRoute), 'event page publishing route writes versions directly');

const eventPagePublishing = read('lib/event-pages/publishing.ts');
for (const rpc of ['atlas_create_event_page_draft', 'atlas_submit_event_page_version', 'atlas_review_event_page_version', 'atlas_publish_event_page_version']) {
  assert(eventPagePublishing.includes(`'${rpc}'`), `event page publishing service does not call fixed RPC ${rpc}`);
}
assert(!/rpc\([^"'`]/.test(eventPagePublishing), 'event page publishing service appears to accept a dynamic RPC name');

const eventPageMigration = read('supabase/migrations/005_event_page_publishing.sql');
assert(eventPageMigration.includes('alter table public.event_pages enable row level security'), 'event page migration does not enable RLS');
assert(eventPageMigration.includes('revoke all on function public.atlas_publish_event_page_version'), 'event page publish RPC is not revoked from public roles');
assert(eventPageMigration.includes('security definer') && eventPageMigration.includes("set search_path = ''"), 'event page RPCs do not use a fixed empty search path');

const readiness = read('lib/atlas-control/readiness.ts');
assert(readiness.includes('Control Plane Configuration Incomplete'), 'missing configuration readiness state is absent');
assert(readiness.includes('Control Plane Migration Not Yet Applied'), 'missing migration readiness state is absent');
assert(readiness.includes('Event Page Publishing Migration Not Yet Applied'), 'missing Event Hub publishing migration readiness state is absent');
assert(readiness.includes('Source Intelligence Migration Not Yet Applied'), 'missing source intelligence migration readiness state is absent');
assert(readiness.includes('Source Synthesis Migration Not Yet Applied'), 'missing source synthesis migration readiness state is absent');
assert(readiness.includes('Editorial Synthesis Migration Not Yet Applied'), 'missing model-assisted synthesis migration readiness state is absent');
assert(readiness.includes('Event Factory Package Migration Not Yet Applied'), 'missing Event Factory package migration readiness state is absent');
assert(readiness.includes('Visual Workflow Migration Not Yet Applied'), 'missing visual workflow migration readiness state is absent');
assert(readiness.includes('Event Factory Revision Migration Not Yet Applied'), 'missing event factory revision migration readiness state is absent');
assert(!readiness.includes('head: true'), 'readiness uses HEAD probes, which can mask missing PostgREST relations');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Atlas Control validations passed.');
