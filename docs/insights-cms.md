# Insights CMS — Setup & Publishing Guide

The Insights section is powered by [Sanity CMS](https://sanity.io). Content is edited in the embedded Studio at `/studio`, published to your Sanity dataset, and served on `/insights` and `/insights/[slug]` via ISR with a 60-second revalidation window.

---

## Architecture

```
sanity.config.ts          Sanity Studio configuration (embedded at /studio)
sanity.cli.ts             Sanity CLI configuration
sanity/
  schemaTypes/
    insight.ts            Insight document — all article fields
    author.ts             Author profile
    category.ts           Category taxonomy
    blockContent.ts       Rich content blocks (portable text + custom types)
    index.ts              Schema registry
  lib/
    client.ts             next-sanity client
    image.ts              @sanity/image-url builder
    queries.ts            GROQ queries + helpers
    types.ts              TypeScript interfaces

app/
  studio/[[...tool]]/
    page.tsx              Embedded Sanity Studio
  insights/
    page.tsx              Listing page (search + category filter + pagination)
    [slug]/page.tsx       Article detail page (SEO + JSON-LD + related)

components/insights/
  InsightCard.tsx         Article card (used in listing + related sections)
  InsightsFilter.tsx      Client-side search/category filter (URL params)
  ContentRenderer.tsx     Portable text renderer (all custom block types)
```

---

## Quick Start

### 1. Create a Sanity project

```bash
# Install Sanity CLI
npm install -g sanity

# Log in
sanity login

# Create a new project (or use an existing one)
sanity init --project-id <YOUR_PROJECT_ID>
```

Or create via the web at **sanity.io/manage → New project**.

Recommended settings:
- **Dataset**: `production`
- **Project name**: `finvio-insights`

### 2. Add environment variables

Copy `.env.local.example` to `.env.local` and fill in the Sanity values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Where to find |
|----------|--------------|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | sanity.io/manage → your project → Settings |
| `NEXT_PUBLIC_SANITY_DATASET` | Usually `production` |
| `NEXT_PUBLIC_SANITY_API_VERSION` | Use `2024-01-01` (any stable date) |
| `SANITY_API_READ_TOKEN` | sanity.io/manage → API → Tokens → Add Viewer token |

### 3. Configure CORS

In **sanity.io/manage → your project → API → CORS Origins**, add:

- `http://localhost:3000` (for local development)
- `https://your-production-domain.com` (for production)

This allows the Studio embedded at `/studio` to authenticate.

### 4. Push schemas to Sanity

```bash
npx sanity@latest dataset import --help  # optional: import sample data
npx sanity@latest schema extract         # validate schemas
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000/studio](http://localhost:3000/studio) to access the CMS.

---

## Content Publishing Workflow

### Create a category (do this first)

1. Go to `/studio` → **Categories** → **+ New document**
2. Fill in: Title (e.g., "Tax Strategy"), Slug (auto-generated), Description
3. Click **Publish**

### Create an author

1. Go to **Authors** → **+ New document**
2. Fill in: Name, Role (e.g., "Head of Finance Content"), Bio, Avatar image
3. Click **Publish**

### Write an article

1. Go to **All Insights** → **+ New document**
2. Fill in the **Content** tab:
   - **Title** — the article headline
   - **Excerpt** — 1–2 sentence description for cards and SEO (max 200 chars)
   - **Featured Image** — upload and set hotspot for cropping
   - **Article Content** — rich text editor (see Content Blocks below)
   - **FAQ** — structured questions for Google rich results
   - **Related Insights** — up to 3 cross-links
3. Fill in **Settings**:
   - **URL Slug** — auto-generated from title, can be edited
   - **Category** — required
   - **Tags** — free-text keywords
   - **Author** — reference to an author document
   - **Published At** — defaults to now
   - **Status** — set to `published` to make it live
4. Fill in **SEO & Meta**:
   - **SEO Title** — overrides title in search results (50–60 chars)
   - **Meta Description** — search result description (150–160 chars)
5. Click **Publish**

The article appears on `/insights` within ~60 seconds (ISR revalidation window).

---

## Content Blocks Reference

The article editor supports these block types (insert via the **+** menu):

| Block | Use case |
|-------|----------|
| Heading (H2/H3/H4) | Section structure; H2/H3 appear in Table of Contents |
| Paragraph | Body text |
| Bullet / Numbered list | Step-by-step or feature lists |
| Blockquote | Pull quotes or highlighted statements |
| **Image** | Full-width or inset article image with caption |
| **Callout** | Info/Tip/Warning/Danger highlighted box |
| **Code Block** | Code snippet with syntax highlighting label |
| **Table** | Data table with optional header row |
| **Comparison Table** | Side-by-side feature comparison with highlighted rows |
| **FAQ Block** | Inline accordion FAQ (separate from the structured FAQ field) |
| **CTA Block** | Conversion block with title, description, button (brand/navy/subtle styles) |

---

## SEO Features

### Automatic

- `<title>` — `seoTitle ?? title` + "— Finvio Insights"
- `<meta name="description">` — `metaDescription ?? excerpt`
- `<link rel="canonical">` — absolute URL
- OpenGraph article tags (type, publishedTime, authors, image)
- Twitter Card (`summary_large_image`)

### JSON-LD Schemas

All three are injected into each article page `<head>`:

1. **Article** — headline, image, datePublished, author, publisher
2. **FAQPage** — auto-generated when the `faq` field has entries
3. **BreadcrumbList** — Home → Insights → Category → Article

---

## On-Demand Revalidation (optional)

To revalidate a page immediately after publishing (instead of waiting up to 60 seconds):

### 1. Create a revalidation API route

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.SANITY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  revalidatePath('/insights', 'page')
  revalidatePath('/insights/[slug]', 'page')
  return NextResponse.json({ revalidated: true })
}
```

### 2. Add a Sanity webhook

In **sanity.io/manage → API → Webhooks → Create webhook**:
- **URL**: `https://your-domain.com/api/revalidate`
- **Dataset**: `production`
- **Trigger on**: `Create`, `Update`, `Delete`
- **Filter**: `_type == "insight"`
- **HTTP Headers**: `x-webhook-secret: <your SANITY_WEBHOOK_SECRET>`

---

## Deployment

The Studio is embedded in your Next.js app so it deploys with it. No separate hosting needed.

To restrict Studio access in production (optional), add auth middleware on the `/studio` route, or rely on Sanity's built-in auth (users must have a Sanity account with collaborator access to your project).

### Vercel

All env variables should be added in the Vercel project settings (Settings → Environment Variables). The `NEXT_PUBLIC_*` variables are exposed to the browser; the others are server-only.

---

## Local Development Tips

- The Studio works at `http://localhost:3000/studio` once env vars are set.
- Drafts (status = "draft") are never shown on the public site — only `status == "published"` articles appear.
- Images are served from `cdn.sanity.io` via the `@sanity/image-url` builder. The `next.config.ts` already has `cdn.sanity.io` in the `images.remotePatterns` allowlist.
- The `@sanity/vision` plugin in the Studio lets you run GROQ queries live against your dataset (useful for debugging).
