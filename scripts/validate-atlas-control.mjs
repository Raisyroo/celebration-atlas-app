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

const loginRoute = read('app/atlas-login/page.tsx');
assert(loginRoute.includes('searchParams') && loginRoute.includes('authError={params?.auth_error}'), 'Login page should pass auth callback error parameters to the form');
assert(loginForm.includes('authError?: string'), 'Login form should accept auth callback error parameters');
assert(loginForm.includes('session_exchange_failed') && loginForm.includes('session_missing'), 'Login form should explain callback session failures');
assert(loginForm.includes('window.location.hash') && loginForm.includes('otp_expired'), 'Login form should surface Supabase hash-only expired link errors');

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
