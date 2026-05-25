import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Finvio" },
      { name: "description", content: "Sign in to your Finvio account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-off-white px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-background p-10 shadow-xl">
        <span className="font-mono-eyebrow text-accent">Welcome back</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-navy">
          Sign in to <span className="font-serif-italic">Finvio.</span>
        </h1>
        <form className="mt-8 space-y-4">
          <div>
            <label className="font-mono-eyebrow text-muted-ink">Email</label>
            <input
              type="email"
              className="mt-2 h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm text-navy outline-none ring-navy/20 focus:ring-2"
              placeholder="founder@acme.com"
            />
          </div>
          <div>
            <label className="font-mono-eyebrow text-muted-ink">Password</label>
            <input
              type="password"
              className="mt-2 h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm text-navy outline-none ring-navy/20 focus:ring-2"
              placeholder="••••••••"
            />
          </div>
          <button
            type="button"
            className="h-12 w-full rounded-lg bg-navy text-sm font-bold text-navy-foreground hover:bg-ink"
          >
            Continue
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-ink">
          New to Finvio?{" "}
          <Link to="/pricing" className="font-semibold text-navy hover:text-accent">
            Open an account
          </Link>
        </p>
      </div>
    </main>
  );
}
