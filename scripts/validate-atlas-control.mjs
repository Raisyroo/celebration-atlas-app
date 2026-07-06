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
const supabaseUnreachableIndex = loginForm.indexOf('payload.code === "supabase_unreachable"');
const browserClientIndex = loginForm.indexOf('createBrowserClient');
const signInWithOtpIndex = loginForm.indexOf('signInWithOtp');
const fallbackStartIndex = loginForm.indexOf('Atlas server could not reach Supabase. Trying direct secure sign-in…');
const fallbackFailureIndex = loginForm.indexOf('Could not reach Supabase for secure sign-in. Please try again.');

assert(sameOriginIndex !== -1, 'LoginForm does not call the same-origin Atlas login endpoint');
assert(browserClientIndex !== -1, 'LoginForm does not create a browser Supabase client for the narrow fallback');
assert(signInWithOtpIndex !== -1, 'LoginForm does not call signInWithOtp for the narrow fallback');
assert(sameOriginIndex !== -1 && loginForm.indexOf('requestBrowserMagicLink(email)') !== -1 && sameOriginIndex < loginForm.indexOf('requestBrowserMagicLink(email)'), 'LoginForm must call the same-origin Atlas login endpoint before invoking the browser Supabase fallback');
assert(supabaseUnreachableIndex !== -1, 'LoginForm fallback is not gated by supabase_unreachable');
assert(fallbackStartIndex !== -1, 'LoginForm does not show the direct secure sign-in fallback start message');
assert(fallbackFailureIndex !== -1, 'LoginForm does not show the direct secure sign-in fallback failure message');
assert(/payload\.code\s*===\s*["']supabase_unreachable["']\s*\)\s*{[\s\S]*requestBrowserMagicLink/.test(loginForm), 'LoginForm browser fallback is not inside the supabase_unreachable branch');
assert(!/payload\.code\s*===\s*["']email_not_authorized["']\s*\)\s*{[\s\S]*requestBrowserMagicLink/.test(loginForm), 'LoginForm falls back for email_not_authorized');
assert(!/payload\.code\s*!==\s*["']supabase_unreachable["'][\s\S]*requestBrowserMagicLink/.test(loginForm), 'LoginForm appears to fall back for non-supabase_unreachable server errors');
assert(!/\bSUPABASE_SERVICE_ROLE_KEY\b/.test(loginForm), 'LoginForm references SUPABASE_SERVICE_ROLE_KEY');
assert(/NEXT_PUBLIC_SUPABASE_URL/.test(loginForm) && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(loginForm), 'LoginForm fallback does not use only public Supabase browser credentials');

const atlasAuthRoute = read('app/api/atlas-auth/request-link/route.ts');
assert(atlasAuthRoute.includes('isAllowedAdminEmail'), 'Atlas auth route does not check the admin allowlist');
assert(atlasAuthRoute.includes('signInWithOtp'), 'Atlas auth route does not request a Supabase magic link');
assert(atlasAuthRoute.includes('crypto.randomUUID()'), 'Atlas auth route does not generate a request ID');
assert(atlasAuthRoute.includes('requestId'), 'Atlas auth route does not return a request ID on failures');
assert(atlasAuthRoute.includes('atlas_auth_magic_link_failed'), 'Atlas auth route does not log magic-link failures');
assert(!atlasAuthRoute.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Atlas auth route references SUPABASE_SERVICE_ROLE_KEY');

for (const file of walk('app/api/atlas-control').filter((file) => file.endsWith('route.ts'))) {
  const source = read(file);
  assert(source.includes('requireAtlasAdmin'), `${file} does not independently require Atlas admin authorization`);
}

const intakeRoute = read('app/api/atlas-control/candidate-intake/route.ts');
assert(intakeRoute.includes('validateCandidateIntake'), 'candidate intake route does not validate payloads');
assert(intakeRoute.includes('idempotencyKey: parsed.value.idempotencyKey'), 'candidate intake route does not forward the idempotency key');
assert(!/\.from\([^)]*event_candidates/.test(intakeRoute), 'candidate intake route writes directly to event_candidates');

const service = read('lib/atlas-control/service.ts');
assert(service.includes('"atlas_intake_event_candidate"'), 'service does not call the typed atlas_intake_event_candidate RPC');
assert(!/rpc\([^"'`]/.test(service), 'service appears to accept a dynamic RPC name');

const readiness = read('lib/atlas-control/readiness.ts');
assert(readiness.includes('Control Plane Configuration Incomplete'), 'missing configuration readiness state is absent');
assert(readiness.includes('Control Plane Migration Not Yet Applied'), 'missing migration readiness state is absent');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Atlas Control validations passed.');
