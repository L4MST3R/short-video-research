import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "Workspaces", exact: true },
  { to: "/hooks", label: "Hooks", exact: false },
  { to: "/scripts", label: "Scripts", exact: false },
  { to: "/projects", label: "Projects", exact: false },
] as const;

/** The app's sections, in the AppShell's bar. */
function AppNav() {
  return (
    <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.exact }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** A page of the app: the AppShell with the app's sections. */
export function Page({ children }: { children: ReactNode }) {
  return <AppShell nav={<AppNav />}>{children}</AppShell>;
}
