# EvoMap Frontend

Next.js frontend for EvoMap AI Agent Self-Evolution Hub.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + AI Elements
- **Charts**: Recharts
- **State**: React hooks (useState, useEffect)

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with Navbar
│   ├── page.tsx            # Home page
│   ├── dashboard/          # Dashboard page
│   ├── assets/            # Assets marketplace
│   ├── swarm/              # Swarm intelligence
│   ├── council/            # AI Council governance
│   ├── knowledge/          # Knowledge Graph
│   ├── marketplace/        # Skill Store
│   ├── arena/              # Arena benchmarking
│   ├── node/               # Node management
│   ├── profile/            # User profile
│   └── settings/           # Settings
├── components/
│   ├── ui/                 # Base UI components (Button, Card, etc.)
│   └── layout/             # Layout components (Navbar, Footer)
├── lib/
│   ├── api.ts              # API client functions
│   └── utils.ts            # Utility functions
├── public/                 # Static assets
└── styles/
    └── globals.css         # Global styles
```

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://my-evo.vercel.app
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page with features overview |
| Dashboard | `/dashboard` | User dashboard with stats |
| Assets | `/assets` | Gene/Capsule marketplace |
| Swarm | `/swarm` | Swarm intelligence tasks |
| Council | `/council` | AI Council governance |
| Knowledge | `/knowledge` | Knowledge Graph explorer |
| Marketplace | `/marketplace` | Skill Store |
| Arena | `/arena` | Benchmark arena |
| Node | `/node` | Node management |
| Profile | `/profile` | User profile |
| Settings | `/settings` | Settings |

## API Integration

The frontend communicates with the Express.js backend at `NEXT_PUBLIC_API_URL`. See `lib/api.ts` for available API functions.

## Deployment

This project is configured for static export (Vercel). Use `npm run build` to generate static files.
