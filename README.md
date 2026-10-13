# Ours Privacy — Image Processing Service

A TypeScript image transformation API and browser-based playground, built for the Ours Privacy Senior Platform Engineer take-home challenge.

## Repository structure

```text
apps/
  api/       Express + TypeScript API (Sharp image processing)
  web/       Next.js + TypeScript playground
.github/
  workflows/ CI checks
 docs/       Design notes and operational decisions
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Local development

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Install dependencies: `npm install`
3. Start the API and UI: `npm run dev`
4. Open the UI at `http://localhost:3000`; the API will run at `http://localhost:4000`.

The implementation is being built incrementally. Until the API and UI steps are complete, some routes and features may be placeholders.

## Scripts

- `npm run dev` — start API and UI together
- `npm run build` — build both apps
- `npm test` — run API tests
- `npm run typecheck` — type-check both apps

## Architecture and trade-offs

The API and UI live in one npm-workspaces repository but deploy independently. The API returns transformed image bytes directly. The UI consumes the public API over HTTP, just like another client. The first milestone establishes the project structure; API validation, safe remote fetching, image processing, tests, caching, and deployment are added in subsequent milestones.

## Security notes

This service fetches user-supplied URLs, which creates SSRF and resource-exhaustion risks. It must not be exposed publicly until URL/IP validation, redirect handling, connection-time safeguards, timeouts, byte and pixel limits, and rate limiting are implemented and tested.

## Deployment

Planned: API on Render and UI on Vercel. Live URLs and exact deployment steps will be added after deployment is configured and verified.
