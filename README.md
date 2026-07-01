This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Event media assets

Some event cards are configured to play local loop videos from `public/event-media/`.
Add the required media files locally (and in your deployment artifact) at:

- `public/event-media/romeo-peach-loop.mp4`
- `public/event-media/electric-forest-loop.mp4`

Poster image files are optional and not required.

## Visual smoke screenshots

This repo includes a minimal Playwright smoke script for visual verification. Install the Chromium browser binary locally when your environment allows browser downloads:

```bash
npm run test:visual-install
```

Then capture the mobile homepage and Romeo Peach Festival flyer flow screenshots:

```bash
npm run test:visual-smoke
```

The script starts the local Next.js app when `VISUAL_SMOKE_BASE_URL` is not set. To reuse an already-running app, set `VISUAL_SMOKE_BASE_URL` to that origin before running the smoke command.

Screenshots are written to `artifacts/visual-smoke/` and are ignored by git. Do not commit screenshot files unless a task explicitly asks for them.

Codex cloud may be unable to install Playwright browsers because Chromium downloads can be blocked there. GitHub Actions is the expected screenshot-capture environment for PRs; it runs the visual smoke workflow and uploads `artifacts/visual-smoke/` as the `celebration-atlas-visual-smoke` artifact.

Future visual PR summaries must not claim visual success unless screenshots were generated and inspected. Visual PRs should link to or reference the GitHub Actions artifact before claiming visual success.
