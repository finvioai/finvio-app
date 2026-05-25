import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`text-xl font-extrabold tracking-tighter text-navy ${className}`}>
      FINVIO<span className="text-accent">.</span>
    </Link>
  );
}
