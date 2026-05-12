# ⚽ Fair Foot - Team Balancer

Create balanced football teams where nobody knows anyone's score. Players vote anonymously on skill levels, and the algorithm builds fair teams automatically.

## How It Works

1. **Sign up** via email
2. **Create a session** for your match day
3. **Players join** the session
4. **Vote anonymously** — rate each player 1-10 (nobody sees your votes)
5. **Generate teams** — the algorithm balances teams so overall power is equal
6. **See the result** — only team assignments are shown, never individual scores

Privacy is core: votes are anonymous, scores are never exposed, and the team-balancing runs server-side so no data leaks to the client.

## Setup

### 1. Install Node.js

Download and install from [nodejs.org](https://nodejs.org/) (LTS recommended).

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Team Balancing Algorithm

Uses a **greedy descent** strategy:
- Calculate average score per player from all anonymous votes
- Sort players by score (highest first)
- Assign each player to the team with the lowest current total
- This produces teams with near-equal total power

The algorithm runs as a PostgreSQL function (`generate_teams`) with `SECURITY DEFINER` — it can read all votes but only returns team assignments. Individual scores never leave the database.

## Tech Stack

- **React 19** + TypeScript + Vite
- **Supabase** — Auth (email/password), PostgreSQL, Row Level Security
- **Tailwind CSS** — styling
- **React Router 7** — navigation
