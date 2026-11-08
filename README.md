# 🍺 House Fines

A small, phone-first web app for the house's weekly fines night.

- **Submit mode** (most of the week): anyone can anonymously accuse a housemate, give a reason and suggest a punishment. Submissions close at **18:00 every Friday (UK time)**, and anything later rolls into the following week. Everyone can see how many motions are in, but not what they say.
- **Party mode** (fines night): the host switches the whole site over in one tap. Every phone shows the same motion live. After discussion the host opens voting, everyone votes **Fine** or **No fine**, and when the host closes voting the verdict is stamped on screen with the names under each side. A motion passes on a strict majority of votes cast; ties fail.
- **History**: past weeks and an all-time Hall of Shame.

Built with Next.js 16 (App Router, TypeScript, Tailwind) and Supabase (Postgres, Auth, Realtime).

---

## Running it locally

You'll need:

- **Node.js 22 or newer.** The Supabase client libraries no longer run on Node 20 (it fails with *"Node.js detected but native WebSocket not found"*). With nvm: `nvm install 24 && nvm use` (the repo has an `.nvmrc`).
- **A Supabase project.** The free tier is plenty. (Prefer everything on your own machine? See [Fully offline](#fully-offline-supabase-cli--docker) below.)

### 1. Install

```bash
nvm install 24 && nvm use
```

```bash
npm install
```

### 2. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Pick the **London (eu-west-2)** region.
2. Once it's ready, open **SQL Editor** → **New query**, paste in the whole of [`supabase/migrations/20261106160000_house_fines.sql`](supabase/migrations/20261106160000_house_fines.sql) and press **Run**. It should say "Success. No rows returned".
3. Turn off public sign-ups: **Authentication** → **Sign In / Providers** → switch off **Allow new users to sign up** → **Save**. Leave the **Email** provider switched on, because that's what username + password logins use behind the scenes.

### 3. Add your keys

```bash
cp .env.example .env.local
```

Fill in `.env.local` from **Project Settings** → **API Keys** (and **Data API** for the URL):

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`). Older projects call it the `anon` key; `NEXT_PUBLIC_SUPABASE_ANON_KEY` works too. |
| `SUPABASE_SECRET_KEY` | A **secret** key (`sb_secret_…`), or the legacy `service_role` key as `SUPABASE_SERVICE_ROLE_KEY`. **Only the seed script uses it.** Never share it or commit it. |
| `MEMBER_EMAIL_DOMAIN` | Leave as `housefines.local`. |

### 4. Create everyone's accounts

There is no sign-up page. You create each account and hand out the details.

```bash
cp scripts/members.example.json scripts/members.json
```

Edit `scripts/members.json`: one entry per housemate, with exactly one `"isHost": true` (you). Leave `password` out to have one generated (a beer brand plus two digits, like `peroni42`), or set your own (6+ characters).

```bash
npm run seed
```

It prints a table of usernames and passwords. Passwords are only shown once, so hand them out, then clear your terminal. Run it again any time you add someone or change a name. Existing passwords are left alone unless you pass `--reset-passwords` (`npm run seed -- --reset-passwords`) or set one in the file. `scripts/members.json` is git-ignored.

Under the hood each username becomes a placeholder email (`sam@housefines.local`), because Supabase Auth is email based. Nobody ever sees it.

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000> and sign in.

**To try it on everyone's phones** (same Wi-Fi), run a production build and listen on the network:

```bash
npm run build && npm run start -- -H 0.0.0.0
```

Then open `http://<your-mac's-IP>:3000` on each phone (find the IP in System Settings → Wi-Fi → Details). On iPhone, **Share → Add to Home Screen** makes it feel like an app.

---

## Running fines night (host guide)

1. **During the week** the host card under the form shows **In the pot**, a hidden list of submitted motions. Bin anything that's a joke or out of order. You can also set how many motions each person can send per week (default 10) and whether the accused can vote on their own motion.
2. **Start fines night.** If this week's deadline hasn't passed yet, you'll be asked whether to close submissions early and include this week's motions.
3. Every phone flips to party mode. Your phone gets a control bar at the bottom:
   - **Call the first motion / Next motion**: brings up a random motion, and voting opens straight away. Everyone gets Fine / No fine buttons and can argue it out while they're up. Votes stay hidden; you only see how many are in.
   - **Close & reveal**: stamps the verdict and shows who voted which way.
   - **Skip**: throws the current motion out (and any votes on it) and moves on.
   - **Settings & queue**: the accused-can-vote switch, motions still to come (with the bin button), and **End fines night**.
4. **End fines night** archives everything to the History page and flips everyone back to submit mode. Motions you never got to stay secret.

---

## How the rules are enforced

All the important rules live in the database, so a modified client can't get around them. The app only renders what Postgres allows.

| Rule | How |
| --- | --- |
| Only signed-in housemates see anything | `proxy.ts` redirects to `/login`. Every table has Row Level Security, and the logged-out role has no access to anything. |
| Submissions are anonymous | `motions` has no submitter column. Motions are only created by `submit_motion()`, which never records who called it. |
| Spam limit | `submission_counts` stores (member, week, number) and nothing else. No timestamps, no motion ids, so it can't be matched to a motion. |
| Friday 18:00 deadline | `submit_motion()` uses the **database clock** to pick the week. The deadline is worked out in `Europe/London` time, so it stays at 18:00 across the clock changes. |
| Nobody reads motions before fines night | Members can only see a motion once it has been brought up (status isn't `pending`). The host can see pending ones, so they can bin abusive ones. |
| One vote per person per motion | Primary key `(motion_id, member_id)`. Votes go through `cast_vote()`, which runs as the voter so the RLS policies apply. |
| Votes are hidden while voting is open | You can read your own vote. Everyone else's only become readable once that motion is `passed` or `failed`. |
| No changing votes after close | Insert/update policies require voting to be open on that exact motion. There is no delete policy. |
| Only the host runs the night | `start_party`, `next_motion`, `open_voting`, `close_voting`, `skip_motion` and `end_party` all check `is_host`. Mode, phase and current motion can't be changed any other way. Only one member can be host (unique index). |
| Live updates | Supabase Realtime on `app_state`, `weeks` and `motions`. Realtime applies RLS too, so nobody receives rows they couldn't read. Phones also re-check every 30 seconds and whenever they wake up. |

I ran the migration against a scratch Postgres with a stand-in Supabase `auth` schema and walked through the whole flow: anonymous submission, the rate limit, roll-over to the next week (including across a clock change), one vote per person, hidden votes, strict majority and ties, skip, deleting motions, archiving, and blocked direct writes.

**A note on anonymity.** The app never stores who submitted what, and nobody can see it through the app, the host included. But whoever owns the Supabase project can look at the backend's request logs, and those include who called what and when. If the house wants to be sure the host can't play detective, have someone else own the Supabase project.

---

## Project layout

```
app/
  login/                 Sign-in page and server action
  (house)/page.tsx       "Tonight": submit mode or party mode, depending on app_state
  (house)/history/       Past weeks and the Hall of Shame
components/
  house-app.tsx          Loads data, listens for realtime changes, picks the mode
  submit-mode.tsx        Countdown, counts, the motion form
  party-mode.tsx         The live motion, voting, tally
  reveal.tsx             Verdict stamp, vote bar, who voted what
  host-tools.tsx         Host card in submit mode: start, settings, motion queue
  host-party-bar.tsx     Host control bar during fines night
lib/
  supabase/              Browser, server and proxy Supabase clients
  data.ts                Browser-side queries (all subject to RLS)
proxy.ts                 Refreshes the session and keeps signed-out visitors on /login
scripts/seed-members.mjs Creates and updates housemate accounts
supabase/migrations/     The schema, RLS policies and game functions
```

---

## Fully offline (Supabase CLI + Docker)

If you'd rather not use a hosted project while developing, install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or OrbStack), then:

```bash
npx supabase init
```

In the generated `supabase/config.toml`, set `enable_signup = false` under `[auth]`. Then:

```bash
npx supabase start
```

That applies the migration automatically and prints a local API URL, publishable key and secret key. Put those in `.env.local` and carry on from step 4.

---

## Troubleshooting

- **"Node.js detected but native WebSocket not found"**: you're on Node 20. Run `nvm use` (Node 24).
- **`npm run dev` hangs on "Compiling…" and never loads**: a stale build cache. Stop the server, delete the `.next` folder, and start it again.
- **Seed script says the email is invalid**: set `MEMBER_EMAIL_DOMAIN` in `.env.local` to a domain you own (for example your own `.co.uk`), and run the seed again. No emails are ever sent.
- **"You're not on the list"** after signing in: that auth user has no row in `members`. Add them to `scripts/members.json` and run `npm run seed`.
- **Phones don't update live**: check **Database → Publications → supabase_realtime** includes `app_state`, `weeks` and `motions` (the migration adds them). Phones still catch up within 30 seconds, or straight away when you switch back to the tab.
- **Reset everything for a test run**, in the SQL editor (this deletes all motions and votes, but not accounts):

  ```sql
  update public.app_state set mode = 'submit', phase = null, current_motion_id = null where id = 1;
  delete from public.weeks;
  ```

---

## Later: Vercel

The app is ready to deploy as-is. It reads the same variable names that Vercel's Supabase integration injects (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Add `MEMBER_EMAIL_DOMAIN` if you changed it. Deployment and custom-domain steps can come when you're ready.
