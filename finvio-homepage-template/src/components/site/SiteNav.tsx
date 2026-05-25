import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const links = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/insights", label: "Insights" },
  { to: "/faq", label: "FAQ" },
] as const;

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-hairline bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <div className="hidden items-center gap-7 text-sm font-medium text-muted-ink md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="transition-colors hover:text-navy"
                activeProps={{ className: "text-navy" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-muted-ink transition-colors hover:text-navy sm:inline"
          >
            Login
          </Link>
          <Link
            to="/login"
            className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground ring-1 ring-navy/10 shadow-sm transition-colors hover:bg-ink"
          >
            Open Account
          </Link>
        </div>
      </div>
    </nav>
  );
}
