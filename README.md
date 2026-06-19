# predictmind-web

Web frontend for **PredictMind** — AI-Powered Market Intelligence & Strategy Research Platform.

Part of the PredictMind platform. Product and architecture documentation lives in the private [`predictmind/app`](https://github.com/predictmind/app) repository.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS (design tokens from the PredictMind Design System)
- ESLint + Prettier

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run format` | Format with Prettier |

## Quality & security

- **CI** runs lint, type-check, and build on every push and PR.
- **CodeQL** code scanning (security + code-quality queries).
- **Dependabot** keeps dependencies and Actions up to date.

## License

Proprietary — © PredictMind. All rights reserved.
