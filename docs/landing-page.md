# Landing Page — Section Reference

## Active sections (in render order)

| Section | Component | File |
|---------|-----------|------|
| Nav | `SiteNav` | `components/landing/SiteNav.tsx` |
| Hero | `Hero` | `components/landing/Hero.tsx` |
| Feature grid | `FeatureGrid` | `components/landing/FeatureGrid.tsx` |
| AI Advisor showcase | `AiAdvisorShowcase` | `components/landing/AiAdvisorShowcase.tsx` |
| Integrations | `Integrations` | `components/landing/Integrations.tsx` |
| Pricing | `Pricing` | `components/landing/Pricing.tsx` |
| FAQ + contact card | `Faq` | `components/landing/Faq.tsx` |
| Final CTA | `FinalCta` | `components/landing/FinalCta.tsx` |
| Footer | `SiteFooter` | `components/landing/SiteFooter.tsx` |

## Hidden sections — re-enable when ready

### TrustedBy (`components/landing/TrustedBy.tsx`)
Shows company logos + stats ($4.2B capital, 99.98% accuracy, 48s response, 2,400+ LLCs).
**Hidden because:** stats are placeholder values. Activate once real customer data exists.

To re-enable, add to `app/page.tsx`:
```tsx
import { TrustedBy } from '@/components/landing/TrustedBy'
// place <TrustedBy /> after <Hero />
```

### Testimonials (`components/landing/Testimonials.tsx`)
Three quote cards (Maya Chen, Daniel Reyes, Priya Anand) — all placeholder names.
**Hidden because:** testimonials are not from real users yet. Activate once real quotes are collected.

To re-enable, add to `app/page.tsx`:
```tsx
import { Testimonials } from '@/components/landing/Testimonials'
// place <Testimonials /> after <Integrations />
```

## Notes

- **Talk to Sales** (Hero + FinalCta) → opens `mailto:hello@finvio.ai`
- **Feature grid** → horizontal snap-scroll carousel on mobile (`< sm`), 3-column grid on desktop
- **Pricing** → shows "Pricing announced at launch" with `hello@finvio.ai` contact link (no tiers yet)
- **Signup** → locked to private beta gate; real signup form is preserved in git history
