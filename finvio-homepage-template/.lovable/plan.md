## Direction

Going with the **Institutional Serif Hybrid** prototype: white canvas, deep navy `#0A1F44`, ink `#0B1220`, restrained gold accent `#C5A059`. Inter for UI, Cormorant Garamond italic for editorial accents, JetBrains Mono for micro labels. Composition and tokens copied verbatim from the prototype.

## Routes

Multi-route TanStack Start site so nav items are real, shareable pages with their own meta.

```
src/routes/
  __root.tsx          (shared nav + footer wrapper, distinct head per child)
  index.tsx           (landing — all sections below)
  features.tsx
  pricing.tsx
  insights.tsx        (editorial hub index)
  faq.tsx
  login.tsx           (placeholder)
```

Anchor links on the landing page (`#features`, `#pricing` etc.) remain for in-page scroll, but the navbar uses real `<Link>` routes.

## Landing page sections (`/`)

1. **Sticky Nav** — Finvio. logo, links (Features, Pricing, Insights, FAQ), Login, "Open Account" CTA.
2. **Hero** — JetBrains Mono eyebrow, large headline ("The operating system for modern capital." with serif italic accent), subhead, dual CTA ("Start Free LLC Filing" / "Talk to Sales").
3. **Dashboard Mockup** — bordered card with sidebar, 3 KPI tiles (Net Position, Tax Liability, Burn Rate), chart placeholder, navy AI Advisor side panel with sample exchange.
4. **Trusted By** — uppercase "Institutional Trust" label, 5 wordmark logos, off-white band.
5. **Core Features** — grid of 12 features (AI advisor, adaptive dashboards, revenue analytics, forecasting, reconciliation, invoices & expenses, audit logs, integrations, voice AI, tax calculations, auditable reports, free LLC tax submission). Clean icon + title + 1-line desc cards.
6. **AI Advisor Showcase** — split: left headline + numbered capabilities, right navy chat card with user/assistant bubbles and action chips.
7. **Integrations** — Stripe, Plaid, Shopify, PayPal, QuickBooks as logo tiles on off-white.
8. **Business Intelligence verticals** — 5 cards (SaaS, SMBs, Agencies, Consultants, Freelancers) showing tailored framing.
9. **Insights Hub Preview** — editorial 3-up grid with portrait images, serif italic titles (Ramp vs Brex, QuickBooks alternatives, AI for finance ops, Multi-entity accounting). "View Archive" link.
10. **Pricing** — Starter / Growth (featured, scaled, navy border + "Most Popular" badge) / Enterprise.
11. **Testimonials** — 3 quote cards from a founder, CFO, agency owner with name + role + entity.
12. **FAQ** — accordion, 6–8 questions.
13. **Final Enterprise CTA** — full-bleed navy band, serif headline, dual CTAs.
14. **Footer** — navy, brand blurb, product/legal columns, SOC2/encryption badges.

## Design tokens (`src/styles.css`)

Replace current `:root` with HSL-converted equivalents of:
- background `#FFFFFF`, off-white `#F7F8FA`
- navy (primary) `#0A1F44`, ink `#0B1220`
- accent (gold) `#C5A059`
- muted slate text, hairline borders `rgba(11,18,32,0.08)`
- radius scale + subtle shadow tokens (`shadow-navy/5`, etc.)
- font stacks via Google Fonts `<link>` injected in `__root.tsx` head: Inter, Cormorant Garamond (italic 600), JetBrains Mono

All component styling uses semantic tokens — no raw hex in components.

## Images

For each `data-lov-image-placeholder` in the chosen prototype (hero dashboard chart, 3 insights covers, AI showcase visual) generate a real image with `imagegen` at the specified width/height, save under `src/assets/`, import as ES6, render with `<img>`.

## Components

Reusable in `src/components/`:
- `SiteNav.tsx`, `SiteFooter.tsx` (used by `__root.tsx`)
- `Hero.tsx`, `DashboardMockup.tsx`, `TrustedBy.tsx`, `FeatureGrid.tsx`, `AiAdvisorShowcase.tsx`, `Integrations.tsx`, `VerticalsSection.tsx`, `InsightsPreview.tsx`, `Pricing.tsx`, `Testimonials.tsx`, `Faq.tsx` (uses shadcn Accordion), `FinalCta.tsx`

## Out of scope

No auth backend, no real article pages — Insights/Login/etc. routes get polished placeholder content + correct meta so navigation works and shares cleanly.
