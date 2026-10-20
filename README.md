# Smart Learning Ledger (`bitacora-app`)

Multi-language journal for students and professionals with an AI tutor that answers **only** from the user's own notes (strict RAG, source citations `[S1]`, verified quotes).

**Stack:** Next.js 15 (App Router, Server Actions), TypeScript, Tailwind 4, Supabase (Postgres + pgvector, RLS, Auth, Storage), OpenAI (`text-embedding-3-small`, `gpt-4o-mini`).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + OpenAI keys
npm run dev
```

Apply `supabase/migrations/001_initial_schema.sql` and `002_storage_and_indexing.sql` (all objects use the `bitacora_` prefix; the `vector` extension must be enabled).

## Structure

- `src/app` – landing (`/`), `/login`, `/dashboard`, `/ledger`, `/chat`, `/auth/callback`
- `src/actions` – server actions (profile, subjects, ledger, attachments, chat)
- `src/services` – chunking, indexing, parsing, RAG, citation verification
- `src/lib` – Supabase clients, OpenAI client, prompts, i18n
- `src/locales` – `en.json`, `es.json`

## Checks

```bash
npx tsc --noEmit
npm run build
```
