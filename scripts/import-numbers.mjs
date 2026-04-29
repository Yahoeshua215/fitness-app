#!/usr/bin/env node
/**
 * import-numbers.mjs
 *
 * Reads imports/latest.json (workouts extracted from
 * "Joshua-Marowitz copy.numbers" by scripts/extract_numbers.py) and
 * inserts each as a workout + its exercises into Supabase, owned by
 * a target user.
 *
 * AUTH MODES (in order of precedence):
 *
 *   1. SERVICE ROLE  (recommended for one-off seeding)
 *      Set SUPABASE_SERVICE_ROLE_KEY in .env.local. Bypasses RLS, no
 *      password needed. The target user is identified by --email
 *      (looked up via the admin API) or by --user-id.
 *
 *   2. PASSWORD GRANT  (uses the user's own login)
 *      Pass --email and --password (or set SUPABASE_PASSWORD).
 *
 * Usage:
 *   node scripts/import-numbers.mjs --email you@example.com           # service role from env
 *   node scripts/import-numbers.mjs --user-id <uuid>                  # service role, explicit id
 *   node scripts/import-numbers.mjs --email you@example.com --password '...'
 *   node scripts/import-numbers.mjs --dry-run                         # preview only
 *
 * The service role key is **secret** — keep it in .env.local only and
 * out of git. It is already in the repo's .gitignore.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---- tiny .env loader ----
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadDotEnv(path.join(ROOT, '.env.local'));
loadDotEnv(path.join(ROOT, '.env'));

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) {
      const key = cur.slice(2);
      const next = arr[i + 1];
      if (!next || next.startsWith('--')) acc.push([key, true]);
      else { acc.push([key, next]); arr[i + 1] = '__consumed__'; }
    }
    return acc;
  }, []),
);

const dryRun = !!args['dry-run'];
const email = args.email || process.env.SUPABASE_EMAIL;
const password = args.password || process.env.SUPABASE_PASSWORD;
const explicitUserId = args['user-id'] || process.env.SUPABASE_USER_ID;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL in .env.local');
  process.exit(1);
}

// ---- read extracted JSON ----
let dataPath = path.join(ROOT, 'imports', 'latest.json');
if (!fs.existsSync(dataPath)) dataPath = path.join(ROOT, 'imports', 'last4.json');
if (!fs.existsSync(dataPath)) {
  console.error('Missing imports/latest.json. Re-run scripts/extract_numbers.py first.');
  process.exit(1);
}
const sheets = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`-> Loaded ${sheets.length} workouts from ${path.relative(ROOT, dataPath)}`);
for (const s of sheets) {
  console.log(`   - ${s.workout_name}  (${s.exercises.length} exercises)`);
}

if (dryRun) {
  console.log('\n[dry-run] Stopping before any DB writes.');
  process.exit(0);
}

// ---- choose auth mode + resolve userId ----
let supabase;
let userId;

if (SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\n-> Using service role key (bypassing RLS).');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (explicitUserId) {
    userId = explicitUserId;
    console.log(`   user_id from --user-id: ${userId}`);
  } else if (email || args['list-users']) {
    // Pull all users (paginated), then match.
    const allUsers = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) { console.error('Admin listUsers failed:', error.message); process.exit(1); }
      allUsers.push(...data.users);
      if (data.users.length < 200) break;
      page++;
    }

    if (args['list-users']) {
      console.log(`\n   ${allUsers.length} user(s) in this Supabase project:`);
      for (const u of allUsers) console.log(`     ${u.id}  ${u.email || '(no email)'}`);
      process.exit(0);
    }

    console.log(`   looking up user by email: ${email}`);
    const found = allUsers.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!found) {
      console.error(`\nNo user found with email ${email}.`);
      console.error(`Available users (${allUsers.length}):`);
      for (const u of allUsers) console.error(`  - ${u.email || '(no email)'}  (${u.id})`);
      console.error(`\nRetry with one of those emails, or with --user-id <uuid>.`);
      process.exit(1);
    }
    userId = found.id;
    console.log(`   user_id: ${userId}`);
  } else {
    console.error('Service role mode needs --email, --user-id, or --list-users.');
    process.exit(1);
  }
} else {
  // Password grant fallback.
  if (!SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_ANON_KEY in .env.local (needed for password sign-in).');
    process.exit(1);
  }
  if (!email || !password) {
    console.error(
      'No SUPABASE_SERVICE_ROLE_KEY found, and --email/--password not provided.\n' +
      'Either add SUPABASE_SERVICE_ROLE_KEY to .env.local, or pass both --email and --password.',
    );
    process.exit(1);
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  console.log(`\n-> Signing in as ${email}...`);
  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
  userId = signIn.user.id;
  console.log(`   signed in (user_id=${userId})`);
}

// ---- delete all existing workouts (exercises cascade) ----
console.log('\n-> Clearing existing workouts...');
const { error: delErr } = await supabase
  .from('workouts')
  .delete()
  .eq('user_id', userId);
if (delErr) { console.error('Failed to clear workouts:', delErr.message); process.exit(1); }
console.log('   done.');

let nextOrder = 0;

// ---- insert each workout + its exercises ----
let totalInserted = 0;
let totalFailed = 0;
for (const sheet of sheets) {
  const name = sheet.workout_name;
  console.log(`\n-> Creating workout: ${name}`);

  const { data: w, error: wErr } = await supabase
    .from('workouts')
    .insert({ name, display_order: nextOrder++, user_id: userId })
    .select()
    .single();
  if (wErr) { console.error(`   workout insert failed: ${wErr.message}`); totalFailed++; continue; }
  console.log(`   workout id=${w.id}`);

  for (const ex of sheet.exercises) {
    const nameParts = (ex.name || '').split(' - ');
    const exRow = {
      workout_id: w.id,
      user_id: userId,
      exercise_order: ex.order || 1,
      name: (nameParts[0] || 'Unnamed').trim().slice(0, 100),
      description: nameParts.slice(1).join(' - ').trim().slice(0, 500),
      reps: (ex.reps || '').slice(0, 100),
      speed: (ex.speed || '').slice(0, 200),
      rest: (ex.rest || '').slice(0, 100),
      sets: Number.isFinite(ex.sets) ? ex.sets : 1,
      instructor_notes: (ex.notes || '').slice(0, 500),
      video_url: (ex.video || '').slice(0, 500),
    };
    const { error: eErr } = await supabase.from('exercises').insert(exRow);
    if (eErr) {
      console.error(`     [x] ${exRow.name}: ${eErr.message}`);
      totalFailed++;
    } else {
      console.log(`     [ok] ${exRow.exercise_order}. ${exRow.name}`);
      totalInserted++;
    }
  }
}

if (!SUPABASE_SERVICE_ROLE_KEY) await supabase.auth.signOut();

console.log(`\n--------------------------------`);
console.log(`Done. ${totalInserted} exercises inserted, ${totalFailed} failed.`);
process.exit(totalFailed > 0 ? 2 : 0);
