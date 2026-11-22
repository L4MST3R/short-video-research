import { createRootRoute, HeadContent, Link, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import {
  themePreferenceInitScript,
  useThemePreference,
} from "@/client/lib/theme";
import appCss from "@/client/styles/app.css?url";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { getGatewayUrl } from "@/serverFunctions/gateway";

export const Route = createRootRoute({
  // Where the Gateway is: the way back to it (AppShell), and the theme pick
  // the app shares with the launcher and every other app.
  loader: () => getGatewayUrl(),
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Short Video Research" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <Page>
      <PageHeader title="Something went wrong" />
      <EmptyState kind="error" title="This page didn't load" description={error instanceof Error ? error.message : undefined} />
    </Page>
  ),
});

function NotFound() {
  return (
    <Page>
      <div data-testid="not-found" className="space-y-10">
        <PageHeader title="Not found" />
        <EmptyState
          title="Nothing here"
          description="It was deleted, or it isn't yours."
          action={<Button render={<Link to="/" />}>Workspaces</Button>}
        />
      </div>
    </Page>
  );
}

/** Toasts ("Copied") in the app's theme. */
function ThemedToaster() {
  const { themePreference } = useThemePreference();
  return <Toaster theme={themePreference} position="bottom-right" />;
}

/** Marks the page as interactive once React has hydrated it. */
function HydratedMarker() {
  useEffect(() => {
    document.body.dataset.hydrated = "true";
  }, []);
  return null;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint: dark never flashes light. */}
        <script
          dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <ThemedToaster />
        <HydratedMarker />
        <Scripts />
      </body>
    </html>
  );
}
