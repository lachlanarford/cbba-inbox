# CBBA Inbox

Internal customer communications platform for the City of Blacktown Basketball Association (CBBA Storm Basketball).

A staff-only inbox tool that consolidates customer messages from multiple channels (email, WhatsApp, social DMs, web forms) into a single interface, with AI-assisted responses powered by Claude.

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd cbba-inbox
npm install
```

### 2. Configure environment variables

Copy the example and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard > Project Settings > API |

### 3. Run database migrations

Apply the migration files in `supabase/migrations/` using the Supabase CLI or the SQL editor in the Supabase dashboard.

### 4. Configure Google OAuth

In the Supabase dashboard:
1. Go to Authentication > Providers > Google
2. Enable the Google provider
3. Add your Google OAuth Client ID and Secret (from Google Cloud Console)
4. Add `https://your-project.supabase.co/auth/v1/callback` as an authorised redirect URI in Google Cloud Console

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

## Links

- Supabase dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard) _(add your project URL here)_
- Vercel project: [https://vercel.com/dashboard](https://vercel.com/dashboard) _(add your project URL here)_

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database + Auth:** Supabase (PostgreSQL, Google OAuth, Row-Level Security)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel
- **AI:** Anthropic Claude API (Phase 4)

## Phase Status

| Phase | Description | Status |
|---|---|---|
| 1 | Project setup, auth, app shell | Complete |
| 2 | Core inbox UI | Pending |
| 3 | Channel integrations | Pending |
| 4 | AI features and chatbot | Pending |
| 5 | Settings and access control | Pending |
| 6 | Feedback and reporting | Pending |
