#!/usr/bin/env node
// Creates (or updates) every housemate's login using the Supabase admin API.
//
//   npm run seed                       # uses scripts/members.json
//   npm run seed -- path/to/file.json  # a different list
//   npm run seed -- --reset-passwords  # give everyone a fresh password
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy
// SUPABASE_SERVICE_ROLE_KEY) in .env.local. The secret key bypasses RLS, so
// it is only ever used here, never by the app.
//
// Usernames become placeholder emails (<username>@housefines.local), because
// Supabase Auth is email based. Nobody ever sees those emails.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomInt } from "node:crypto";

const args = process.argv.slice(2);
const resetPasswords = args.includes("--reset-passwords");
const file = args.find((a) => !a.startsWith("--")) ?? "scripts/members.json";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = (process.env.MEMBER_EMAIL_DOMAIN ?? "housefines.local").toLowerCase();

if (!url || !secret) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.\n" +
      "Copy .env.example to .env.local, fill it in, then run: npm run seed",
  );
}

// ---------------------------------------------------------------- read list
let raw;
try {
  raw = JSON.parse(await readFile(file, "utf8"));
} catch (err) {
  fail(
    `Couldn't read ${file}: ${err.message}\n` +
      "Copy scripts/members.example.json to scripts/members.json and edit it.",
  );
}

const list = Array.isArray(raw) ? raw : raw.members;
if (!Array.isArray(list) || list.length === 0) fail(`${file} has no members in it.`);

const USERNAME = /^[a-z0-9][a-z0-9_.-]{1,31}$/;
const seen = new Set();
const members = list.map((m, i) => {
  const username = String(m.username ?? "").trim().toLowerCase();
  const displayName = String(m.displayName ?? m.display_name ?? "").trim();
  const where = `Member ${i + 1} (${username || "no username"})`;
  if (!USERNAME.test(username)) {
    fail(`${where}: usernames must be 2–32 characters: lower-case letters, numbers, . _ or -`);
  }
  if (seen.has(username)) fail(`${where}: username used twice.`);
  seen.add(username);
  if (displayName.length < 1 || displayName.length > 40) {
    fail(`${where}: displayName must be 1–40 characters.`);
  }
  if (m.password != null && String(m.password).length < 6) {
    fail(`${where}: passwords need at least 6 characters (or leave it out to generate one).`);
  }
  return {
    username,
    displayName,
    isHost: m.isHost === true || m.is_host === true,
    password: m.password != null ? String(m.password) : null,
  };
});

const hosts = members.filter((m) => m.isHost);
if (hosts.length !== 1) fail(`Exactly one member needs "isHost": true (found ${hosts.length}).`);

// ---------------------------------------------------------------- seed
const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
  // This script never uses realtime. Older Node versions have no built-in
  // WebSocket, which supabase-js checks for, so hand it a dummy.
  realtime: globalThis.WebSocket ? undefined : { transport: class NoWebSocket {} },
});

const existing = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) fail(`Couldn't list users: ${error.message}`);
  for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u);
  if (data.users.length < 200) break;
}

// Only one host is allowed at a time, so demote anyone else first.
{
  const { error } = await supabase
    .from("members")
    .update({ is_host: false })
    .eq("is_host", true)
    .neq("username", hosts[0].username);
  if (error) fail(`Couldn't update the old host: ${error.message}\nHave you run the SQL migration?`);
}

const handout = [];
// Host last, so the "one host" rule never sees two at once.
for (const m of [...members].sort((a, b) => Number(a.isHost) - Number(b.isHost))) {
  const email = `${m.username}@${domain}`;
  const metadata = { username: m.username, display_name: m.displayName };
  let user = existing.get(email);
  let password = null;

  if (user) {
    const update = { user_metadata: metadata };
    if (m.password || resetPasswords) {
      password = m.password ?? makePassword();
      update.password = password;
    }
    const { error } = await supabase.auth.admin.updateUserById(user.id, update);
    if (error) fail(`Couldn't update ${m.username}: ${error.message}`);
  } else {
    password = m.password ?? makePassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) {
      fail(
        `Couldn't create ${m.username}: ${error.message}` +
          (/email/i.test(error.message)
            ? `\nIf Supabase rejects "${domain}", set MEMBER_EMAIL_DOMAIN in .env.local to a domain you own.`
            : ""),
      );
    }
    user = data.user;
  }

  const { error } = await supabase.from("members").upsert(
    { id: user.id, username: m.username, display_name: m.displayName, is_host: m.isHost },
    { onConflict: "id" },
  );
  if (error) fail(`Couldn't save ${m.username} to members: ${error.message}`);

  handout.push({ name: m.displayName, username: m.username, password, host: m.isHost });
}

// ---------------------------------------------------------------- report
console.log(`\n🍺  ${handout.length} housemates ready.\n`);
const width = Math.max(...handout.map((h) => h.name.length), 4);
const uWidth = Math.max(...handout.map((h) => h.username.length), 8);
console.log(`  ${"Name".padEnd(width)}  ${"Username".padEnd(uWidth)}  Password`);
console.log(`  ${"-".repeat(width)}  ${"-".repeat(uWidth)}  ${"-".repeat(20)}`);
for (const h of handout.sort((a, b) => a.name.localeCompare(b.name))) {
  const pw = h.password ?? "(unchanged)";
  console.log(`  ${h.name.padEnd(width)}  ${h.username.padEnd(uWidth)}  ${pw}${h.host ? "   👑 host" : ""}`);
}
if (handout.some((h) => h.password)) {
  console.log(
    "\nPasswords are only shown now (Supabase stores hashes). Hand them out, then clear your terminal.",
  );
}

// ---------------------------------------------------------------- helpers
function makePassword() {
  // Easy to remember on a night out: a beer brand and two digits.
  // Every name is 4+ letters so it clears Supabase's 6-character minimum.
  const words = [
    "carling", "peroni", "stella", "fosters", "guinness", "heineken", "madri",
    "moretti", "corona", "coors", "camden", "estrella", "asahi", "cobra",
    "budweiser", "kronenbourg",
  ].filter((w) => w.length >= 4);
  return `${words[randomInt(words.length)]}${randomInt(10, 100)}`;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
