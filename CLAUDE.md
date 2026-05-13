# CBBA Inbox -- Claude Code Context

## Project
Internal customer communications platform for City of Blacktown Basketball Association (CBBA / CBBA Storm Basketball).

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL, Auth, RLS)
- Tailwind CSS
- Vercel (hosting)
- Anthropic Claude API (AI features, added in Phase 4)

## Branding
- Primary purple: #604484
- Gold: #FBB33F
- Navy: #21222C
- Orange: #F58945
- Font: Poppins

## Domain Language
- Conversations: a ticket/thread (one per customer interaction)
- Messages: individual messages within a conversation
- Channels: gmail | whatsapp | facebook | instagram | form | chat
- Departments: Reps | Comps | LTP | Other
- Priorities: Low | Medium | High | Urgent
- Statuses: Open | In Progress | Waiting | Closed
- Roles: admin | staff

## Conventions
- Use TypeScript throughout, no any types
- Use Supabase server client for all data fetching in Server Components and API routes
- Use Supabase browser client only in Client Components
- All database access must go through RLS -- never bypass with service role key on the client
- Components go in /components, grouped by feature (e.g. /components/inbox, /components/auth)
- Database types go in /types/supabase.ts (Supabase client Database type) and /types/database.ts (domain types and joined query result types)
- When casting Supabase join query results to joined types, use double cast: `data as unknown as MyType[]`
- AppUser is available via useAppUser() hook (from contexts/AppUserContext) in any client component under app/(app)
- Do not use em dashes in any copy or comments

## Phase Status
- Phase 1: Project setup, auth, app shell -- COMPLETE
- Phase 2: Core inbox UI -- COMPLETE
- Phase 3: Channel integrations -- CURRENT
- Phase 4: AI features and chatbot -- PENDING
- Phase 5: Settings and access control -- PENDING
- Phase 6: Feedback and reporting -- PENDING
