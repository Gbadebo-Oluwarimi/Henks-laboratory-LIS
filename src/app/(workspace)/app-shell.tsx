
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  LogOut,
  PackageOpen,
  Droplets,
  Activity,
  ListChecks,
  UsersRound,
  ShieldCheck,
  X,
} from "lucide-react";

import { signOut } from "@/app/actions";
import { ChatPopup } from "@/app/(workspace)/chat/chat-ui";
import { labBranding } from "@/lib/branding";
import { lockedModules } from "@/lib/locked-modules";
import type { UserRole } from "@/lib/models";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { href: "/clients", label: "Patients", icon: UsersRound, group: "WORKSPACE" },
  { href: "/orders", label: "Lab orders", icon: ClipboardList, group: "WORKSPACE" },
  { href: "/specimens", label: "Specimens", icon: Droplets, group: "WORKSPACE" },
  { href: "/quality-control", label: "Quality control", icon: Activity, group: "WORKSPACE" },
  { href: "/worklist", label: "Test worklist", icon: ListChecks, group: "WORKSPACE" },
  { href: "/reagents", label: "Reagents", icon: PackageOpen, group: "WORKSPACE" },
  { href: "/departments", label: "Departments & tests", icon: Building2, group: "REFERENCE" },
  { href: "/catalogue", label: "Test catalogue", icon: FlaskConical, group: "REFERENCE" },
  { href: "/reports", label: "Reports", icon: FileText, group: "REFERENCE" },
  { href: "/users", label: "User Management", icon: ShieldCheck, group: "ADMINISTRATION" },
  ...lockedModules.map(({ slug, label }) => ({
    href: `/modules/${slug}`,
    label,
    icon: LockKeyhole,
    group: "ADVANCED LIS",
  })),
];

const pageNames: Record<string, string> = {
  "/dashboard": "Overview",
  "/clients": "Patients",
  "/orders": "Lab orders",
  "/specimens": "Specimens",
  "/quality-control": "Quality control",
  "/reagents": "Reagents",
  "/worklist": "Test worklist",
  "/catalogue": "Test catalogue",
  "/departments": "Departments and test structure",
  "/reports": "Reports",
  "/chat": "Team chat",
  "/users": "User Management",
  ...Object.fromEntries(
    lockedModules.map(({ slug, label }) => [`/modules/${slug}`, label]),
  ),
};

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; role: UserRole; canAuthorizeReports?: boolean; canViewReagents?: boolean };
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const pageTitle =
    Object.entries(pageNames).find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1]
    ?? (pathname.includes("/clients/") ? "Patient record" : pathname.includes("/orders/") ? "Order details" : "Workspace");

  const groups = ["WORKSPACE", "REFERENCE", "ACCOUNT", "ADMINISTRATION", "ADVANCED LIS"] as const;

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-button icon-button"
        type="button"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      {menuOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <Link className="wordmark" href="/dashboard" onClick={() => setMenuOpen(false)}>
          <Image
            src={labBranding.logo}
            width={360}
            height={170}
            alt={labBranding.name}
            priority
          />
        </Link>

        <nav className="side-nav" aria-label="Main navigation">
          {groups.map((group) => {
            const visibleItems = navigation.filter(
              (item) =>
                item.group === group &&
                (item.href !== "/departments" || user.role === "Administrator") &&
                (item.href !== "/users" || user.role === "Administrator") &&
                (item.href !== "/reagents" || user.canViewReagents === true),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div className="nav-group" key={group}>
                <p className="nav-group-label">{group}</p>

                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(`${href}/`));

                  return (
                    <Link
                      className={`nav-link ${active ? "nav-link-active" : ""}`}
                      href={href}
                      key={href}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <span className="avatar" aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </span>

          <div className="account-details">
            <span className="account-name">{user.name}</span>
            <span className="account-role">{user.role}</span>
          </div>

          <form action={signOut}>
            <button
              className="sign-out-button"
              type="submit"
              aria-label="Sign out"
              title="Sign out"
            >
              ↗
            </button>
          </form>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{pageTitle}</strong>
          </div>

          <div
            className="account-menu"
            ref={accountMenuRef}
            onMouseEnter={() => setAccountMenuOpen(true)}
            onMouseLeave={() => setAccountMenuOpen(false)}
          >
            <button
              className="topbar-user account-menu-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label={`Account menu for ${user.name}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <span className="session-indicator" />
              Signed in
              <span className="topbar-initial">{user.name.slice(0, 1).toUpperCase()}</span>
              <ChevronDown size={13} className={`account-menu-chevron ${accountMenuOpen ? "account-menu-chevron-open" : ""}`} />
            </button>
            {accountMenuOpen && (
              <section className="account-menu-panel" role="menu" aria-label="Account options">
                <div className="account-menu-identity">
                  <span className="account-menu-name">{user.name}</span>
                  <span className="account-menu-role">{user.role}</span>
                </div>
                <a
                  className="account-menu-promo"
                  href="https://picotelnigeria.com"
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <span className="account-menu-promo-icon"><Building2 size={17} /></span>
                  <span><strong>Bring this system locally to your hospital or clinic</strong><small>Visit picotelnigeria.com</small></span>
                </a>
                <form action={signOut}>
                  <button className="account-menu-logout" type="submit" role="menuitem">
                    <LogOut size={15} /> Sign out
                  </button>
                </form>
              </section>
            )}
          </div>
        </header>

        <main className="page-content">{children}</main>
        <footer className="workspace-footer">
          <span>Powered by <strong>Picotel Network Solutions</strong></span>
        </footer>
      </div>
      <ChatPopup />
    </div>
  );
}
