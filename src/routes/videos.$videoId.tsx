import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Download, ExternalLink, PenLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToProject } from "@/client/components/AddToProject";
import { Page } from "@/client/components/AppNav";
import { AiUnavailable } from "@/client/components/AiUnavailable";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Textarea } from "@/client/components/ui/textarea";
import { useMutation } from "@/client/hooks/useMutation";
import { formatDate, formatDateTime, formatNumber, formatScore, PLATFORM_LABELS } from "@/client/lib/format";
import { getVideoPage, runBreakdown, saveTranscript } from "@/serverFunctions/videos";

export const Route = createFileRoute("/videos/$videoId")({
  loader: ({ params }) => getVideoPage({ data: { id: params.videoId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.video.title }] : [] }),
  component: VideoPage,
});

const BREAKDOWN_FIELDS = [
  ["hook", "Hook"],
  ["format", "Format"],
  ["structure", "Story structure"],
  ["angle", "Angle"],
  ["whyItWorked", "Why it outperformed"],
  ["howToReuse", "How to reuse"],
] as const;

function VideoPage() {
  const { video, projects } = Route.useLoaderData();
  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/channels/$channelId"
            params={{ channelId: video.channelId }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {video.handle}
          </Link>
        }
        title={video.title}
        description={
          <dl className="flex flex-wrap gap-x-4 gap-y-1">
            <Stat label="Platform" value={PLATFORM_LABELS[video.platform]} />
            <Stat label="Posted" value={formatDate(video.postedAt)} />
            <Stat label="Views" value={formatNumber(video.views)} />
            <Stat label="Likes" value={formatNumber(video.likes)} />
            <Stat label="Comments" value={formatNumber(video.comments)} />
            <Stat label="Score" value={formatScore(video.score)} />
          </dl>
        }
        actions={
          <>
            <Button variant="outline" render={<a href={video.url} target="_blank" rel="noreferrer noopener" />}>
              <ExternalLink data-icon="inline-start" aria-hidden />
              Original
            </Button>
            <Button variant="outline" render={<Link to="/scripts" search={{ from: video.id }} />}>
              <PenLine data-icon="inline-start" aria-hidden />
              Write a script
            </Button>
            <AddToProject kind="video" refId={video.id} projects={projects} />
          </>
        }
      />
      <TranscriptCard id={video.id} title={video.title} initial={video.transcript} />
      <BreakdownCard id={video.id} breakdown={video.breakdown} breakdownAt={video.breakdownAt} />
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function TranscriptCard({ id, title, initial }: { id: string; title: string; initial: string }) {
  const { run, pending } = useMutation();
  const [text, setText] = useState(initial);
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "transcript"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <label htmlFor="transcript">Transcript</label>
        </CardTitle>
        <CardAction className="flex gap-2">
          <CopyButton value={text} successMessage="Transcript copied" size="sm" />
          <Button variant="outline" size="sm" onClick={download} disabled={!text}>
            <Download data-icon="inline-start" aria-hidden />
            Download .txt
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          id="transcript"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste what's said in the video."
        />
        <Button
          pending={pending}
          disabled={text === initial}
          onClick={async () => {
            const saved = await run(() => saveTranscript({ data: { id, transcript: text } }));
            if (saved) toast.success("Transcript saved");
            else if (saved === null) toast.error("This video no longer exists.");
          }}
        >
          Save transcript
        </Button>
      </CardContent>
    </Card>
  );
}

type BreakdownData = NonNullable<Awaited<ReturnType<typeof getVideoPage>>["video"]["breakdown"]>;

function BreakdownCard({ id, breakdown, breakdownAt }: { id: string; breakdown: BreakdownData | null; breakdownAt: string | null }) {
  const { run, pending } = useMutation();
  const [unavailable, setUnavailable] = useState<{ setup: string | null } | null>(null);
  async function analyze() {
    setUnavailable(null);
    const result = await run(() => runBreakdown({ data: { id } }));
    if (!result) return;
    if (result.ok) toast.success("Breakdown saved");
    else if (result.unavailable) setUnavailable({ setup: result.setup });
    else toast.error(result.message);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakdown</CardTitle>
        <CardAction>
          <Button variant={breakdown ? "outline" : "default"} size="sm" pending={pending} onClick={analyze}>
            <Sparkles data-icon="inline-start" aria-hidden />
            {breakdown ? "Run again" : "Run breakdown"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {unavailable ? <AiUnavailable what="Analysis" setup={unavailable.setup} /> : null}
        {breakdown ? (
          <div data-testid="breakdown" className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {BREAKDOWN_FIELDS.map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="text-sm text-muted-foreground">{breakdown[key]}</dd>
                </div>
              ))}
            </dl>
            {breakdownAt ? <p className="text-xs text-muted-foreground">Run {formatDateTime(breakdownAt)}</p> : null}
          </div>
        ) : !unavailable ? (
          <p className="text-sm text-muted-foreground">
            No breakdown yet. A saved transcript makes it more specific.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
