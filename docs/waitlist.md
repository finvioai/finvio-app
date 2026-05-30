# Waitlist — LaunchList Integration

## Overview

The waitlist is powered by [LaunchList](https://getlaunchlist.com). Submissions are collected at `https://finvio.ai/waitlist` and managed in the LaunchList dashboard.

## Configuration

| Setting | Value |
|---------|-------|
| Public Key | `o28D06` |
| Form Endpoint | `https://getlaunchlist.com/s/o28D06` |
| Widget Script | `https://getlaunchlist.com/js/widget.js` |
| Waitlist URL | `https://finvio.ai/waitlist` |

## Where things live in the code

| File | Purpose |
|------|---------|
| `app/waitlist/page.tsx` | The `/waitlist` route — page copy + widget mount point |
| `app/layout.tsx` | Loads the LaunchList widget script globally via `next/script` |
| `proxy.ts` | `/waitlist` is in `publicPaths` — no auth redirect |

## How the widget is embedded

The LaunchList script is loaded once globally in `app/layout.tsx` using Next.js `<Script strategy="afterInteractive">`. It scans the DOM for any element with `class="launchlist-widget"` and renders the signup form into it.

The widget mount point in `app/waitlist/page.tsx`:

```tsx
<div className="launchlist-widget" data-key-id="o28D06" />
```

The `data-key-id` attribute tells LaunchList which project to post submissions to.

## Receiving submissions

1. Log in at [https://app.getlaunchlist.com](https://app.getlaunchlist.com)
2. Open your project → **Subscribers** tab to see all signups with timestamps and referral sources
3. Export as CSV from the Subscribers tab at any time
4. Enable email notifications under **Project Settings → Notifications** to get an email for each new signup

## Sharing the waitlist

The canonical shareable URL is:

```
https://finvio.ai/waitlist
```

You can also share the LaunchList-hosted page directly at:

```
https://getlaunchlist.com/s/o28D06
```

## Customising the widget appearance

LaunchList's widget reads your project's branding settings from the dashboard (button colour, placeholder text, success message). To change the look:

1. Log in → your project → **Widget Settings**
2. Adjust colours, copy, and success message
3. Changes apply immediately — no redeploy required

To apply custom CSS beyond LaunchList's settings, target `.launchlist-widget` and its children in `app/globals.css`.
