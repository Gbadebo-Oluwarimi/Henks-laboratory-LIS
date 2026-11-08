import type { ReactNode } from "react";
import { AuthShowcase } from "@/app/auth-showcase";

export function AuthLayout({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <main className={`auth-page${compact ? " auth-page-compact" : ""}`}>
      <div className="auth-shell">
        <aside className="auth-showcase" aria-label="Henks Medical Limited care team">
          <AuthShowcase />
        </aside>
        <section className="auth-form-side">{children}</section>
      </div>
    </main>
  );
}
