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
assert(!loginForm.includes('createBrowserClient'), 'LoginForm still imports or creates a browser Supabase client');
assert(!loginForm.includes('signInWithOtp'), 'LoginForm still calls signInWithOtp directly');
assert(loginForm.includes('/api/atlas-auth/request-link'), 'LoginForm does not call the same-origin Atlas login endpoint');

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
