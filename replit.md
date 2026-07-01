# Website Clone Prompt Generator

A tool where users paste any website URL and get a detailed AI-generated prompt for cloning/recreating that website. Powered by TinyFish AI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/website-cloner run dev` — run the frontend (port auto-assigned)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required secrets: `TINYFISH_API_KEY` — TinyFish AI API key (OpenAI-compatible)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/website-cloner)
- API: Express 5 (artifacts/api-server)
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- AI: TinyFish API (OpenAI-compatible, endpoint: https://api.tinyfish.io/v1)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `artifacts/api-server/src/routes/generate-prompt.ts` — main backend route
- `artifacts/website-cloner/src/` — React frontend
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)

## Architecture decisions

- TinyFish API is used as an OpenAI-compatible endpoint (`gpt-4o` model)
- Backend fetches target website HTML, truncates to ~15K chars, sends to AI for analysis
- SSRF protection: hostname resolved to IP, private ranges blocked before fetch
- Response body capped at 2MB to prevent resource exhaustion
- 60s timeout on TinyFish API call; 15s timeout on target website fetch

## Product

Users paste any public website URL → backend fetches and analyzes its HTML → TinyFish AI generates a comprehensive clone prompt covering layout, colors, typography, components, responsive design, and tech stack recommendations → user can copy or download the prompt.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- TinyFish API endpoint: `https://api.tinyfish.io/v1/chat/completions`
- DB is provisioned but not used by this app (no schema needed)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
