import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatCompact, formatDate, formatScore, PLATFORM_LABELS } from "@/client/lib/format";
import { feedSearch, type FeedSearch } from "@/shared/constants";
import { getFeed } from "@/serverFunctions/workspaces";

export const Route = createFileRoute("/workspaces/$workspaceId/feed")({
  validateSearch: feedSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getFeed({ data: { workspaceId: params.workspaceId, ...deps } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Outlier feed · ${loaderData.workspace.name}` }] : [] }),
  component: FeedPage,
});

const PLATFORMS = [
  { value: "all", label: "All platforms" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
] as const;
const WINDOWS = [
  { value: "all", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
const SORTS = [
  { value: "score", label: "Score" },
  { value: "views", label: "Views" },
  { value: "date", label: "Newest" },
] as const;

function FeedPage() {
  const { workspace, feed } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [minScore, setMinScore] = useState(search.minScore === undefined ? "" : String(search.minScore));
  const update = (change: Partial<FeedSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...change, page: change.page ?? 1 }), replace: true });

  useEffect(() => {
    const parsed = minScore.trim() === "" ? undefined : Number(minScore);
    if (parsed !== undefined && Number.isNaN(parsed)) return;
    if (parsed === search.minScore) return;
    const timer = setTimeout(() => void update({ minScore: parsed }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore]);

  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId: workspace.id }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {workspace.name}
          </Link>
        }
        title="Outlier feed"
        description="Score is views divided by the channel's median views. Channels need 3 videos for a score."
      />
      {feed.totalInWorkspace === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No videos yet"
          description="Add channels and their videos to this workspace, and they're ranked here."
          action={
            <Button render={<Link to="/workspaces/$workspaceId" params={{ workspaceId: workspace.id }} />}>
              Go to channels
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <SimpleSelect
              ariaLabel="Platform"
              testId="feed-platform"
              items={PLATFORMS}
              value={search.platform ?? "all"}
              onChange={(platform) => update({ platform })}
            />
            <SimpleSelect
              ariaLabel="Posted"
              testId="feed-window"
              items={WINDOWS}
              value={search.window ?? "all"}
              onChange={(window) => update({ window })}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="feed-min-score" className="whitespace-nowrap text-muted-foreground">
                Min score
              </Label>
              <Input
                id="feed-min-score"
                data-testid="feed-min-score"
                type="number"
                min={0}
                step={0.5}
                className="w-20"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-sm text-muted-foreground">Sort by</span>
              <SimpleSelect ariaLabel="Sort by" testId="feed-sort" items={SORTS} value={search.sort ?? "score"} onChange={(sort) => update({ sort })} />
            </div>
          </div>
          {feed.total === 0 ? (
            <EmptyState kind="filtered" title="No videos match these filters" />
          ) : (
            <>
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Video</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead>Posted</TableHead>
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feed.items.map((v) => (
                      <TableRow key={v.id} data-testid="feed-row">
                        <TableCell className="text-right">
                          <Badge
                            data-testid="score"
                            variant={v.score !== null && v.score >= 2 ? "soft" : "secondary"}
                            className="tabular-nums"
                          >
                            {formatScore(v.score)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-72">
                          <Link
                            to="/videos/$videoId"
                            params={{ videoId: v.id }}
                            className="block truncate font-medium hover:underline"
                          >
                            {v.title}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {v.handle} · {PLATFORM_LABELS[v.platform]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCompact(v.views)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(v.postedAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Open original"
                            render={<a href={v.url} target="_blank" rel="noreferrer noopener" />}
                          >
                            <ExternalLink aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{feed.total} {feed.total === 1 ? "video" : "videos"}</span>
                <div className="flex items-center gap-2">
                  <span data-testid="feed-page">
                    Page {feed.page} of {feed.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous page"
                    disabled={feed.page <= 1}
                    onClick={() => update({ page: feed.page - 1 })}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next page"
                    disabled={feed.page >= feed.pages}
                    onClick={() => update({ page: feed.page + 1 })}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Page>
  );
}
