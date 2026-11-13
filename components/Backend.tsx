import { Suspense } from "react";
import Link from "next/link";
import { FreeTierClient, GetAccountPlanStateCommand, GetFreeTierUsageCommand } from "@aws-sdk/client-freetier";
import dbConnect from "@/lib/mongoose";
import { BackendShell } from "./BackendLink";

// Admins only: how much of each platform's free allowance the site uses. Profile renders this for ?tab=backend.

const MB = 1024 ** 2;
const ATLAS_M0 = 512 * MB; // Atlas counts dataSize + indexSize against the free cluster's 512 MB

const bytes = (n: number) => n >= MB ? `${(n / MB).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`;
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// One row of a meter list: name, bar, figure. The fill turns amber at 70% and red at 90%, with a word so it isn't color alone.
// ranked: bars compared against each other, not a limit, so they never warn
function Meter({ name, used, limit, label, ranked }: { name: string; used: number; limit: number; label: string; ranked?: boolean }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const [fill, track, word] = ranked ? ["bg-blue-500", "bg-blue-100 dark:bg-blue-950", ""]
    : pct >= 90 ? ["bg-red-600", "bg-red-100 dark:bg-red-950", "⚠ Near limit"]
    : pct >= 70 ? ["bg-amber-400", "bg-amber-100 dark:bg-amber-950", "▲ Getting close"]
    : ["bg-blue-500", "bg-blue-100 dark:bg-blue-950", ""];
  return (
    <li className="grid grid-cols-1 sm:grid-cols-[12rem_1fr_auto] items-center gap-x-4 gap-y-1">
      <span className="text-sm truncate" title={name}>{name}</span>
      <div className={`h-2 rounded-full ${track}`} role="meter" aria-label={name} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} title={`${label} (${pct.toFixed(1)}%)`}>
        {/* a sliver stays visible for tiny-but-nonzero usage */}
        <div className={`h-full rounded-full ${fill}`} style={{ width: used > 0 ? `max(${pct}%, 4px)` : 0 }} />
      </div>
      <span className="text-sm tabular-nums text-zinc-500 sm:text-right">{word && <b className="mr-2 text-zinc-900 dark:text-zinc-100">{word}</b>}{label}</span>
    </li>
  );
}

function Card({ title, plan, children }: { title: string; plan: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mb-5 text-sm text-zinc-500">{plan}</p>
      {children}
    </section>
  );
}

const Loading = () => <p className="text-sm text-zinc-500 animate-pulse">Measuring…</p>;
const Failed = ({ e }: { e: unknown }) => <p className="text-sm text-red-600">Couldn&apos;t read usage: {e instanceof Error ? e.message : String(e)}</p>;

async function mongoUsage() {
  const db = (await dbConnect()).connection.db!;
  const s = await db.stats();
  const cols = await Promise.all((await db.listCollections().toArray()).map(async (c) => {
    const [x] = await db.collection(c.name).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
    return { name: c.name, size: x.storageStats.size + x.storageStats.totalIndexSize, count: x.storageStats.count as number };
  }));
  cols.sort((a, b) => b.size - a.size);
  return { used: s.dataSize + s.indexSize, objects: s.objects as number, cols };
}

async function Mongo() {
  const d = await mongoUsage().catch((e: unknown) => ({ error: e }));
  if ("error" in d) return <Failed e={d.error} />;
  const { used, objects, cols } = d;
  return (<>
    <ul className="flex flex-col gap-3">
      <Meter name="Storage (data + indexes)" used={used} limit={ATLAS_M0} label={`${bytes(used)} of 512 MB`} />
    </ul>
    <h3 className="mt-6 mb-3 text-sm font-bold text-zinc-500">By collection · {num(objects)} documents</h3>
    {/* ranked bars against the biggest collection, so small ones are still comparable */}
    <ul className="flex flex-col gap-2">
      {cols.map((c) => <Meter key={c.name} name={c.name} used={c.size} limit={cols[0].size} ranked label={`${bytes(c.size)} · ${num(c.count)} docs`} />)}
    </ul>
  </>);
}

async function awsUsage() {
  // Billing APIs live in us-east-1. Locally the SDK uses AWS_PROFILE; on Lambda, the function's role.
  const aws = new FreeTierClient({ region: "us-east-1" });
  const [plan, usage] = await Promise.all([
    aws.send(new GetAccountPlanStateCommand({})),
    aws.send(new GetFreeTierUsageCommand({})),
  ]);
  const end = plan.accountPlanExpirationDate!;
  const start = new Date(end); start.setMonth(start.getMonth() - 6); // the Free plan lasts 6 months
  const day = 864e5;
  return { plan, usage, end, elapsed: Math.max(0, (Date.now() - +start) / day), total: (+end - +start) / day };
}

async function Aws() {
  const d = await awsUsage().catch((e: unknown) => ({ error: e }));
  if ("error" in d) return <Failed e={d.error} />;
  const { plan, usage, end, elapsed, total } = d;
  return (<>
    <p className="mb-5"><span className="text-5xl font-bold tabular-nums">${num(plan.accountPlanRemainingCredits?.amount ?? 0)}</span> <span className="text-zinc-500">credits left</span></p>
    <ul className="flex flex-col gap-3">
      <Meter name="Free plan time used" used={elapsed} limit={total} label={`${Math.round(total - elapsed)} days left · ends ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`} />
      {usage.freeTierUsages?.map((u, i) => (
        <Meter key={i} name={`${u.service} · ${u.description}`} used={u.actualUsageAmount ?? 0} limit={u.limit ?? 0}
          label={`${num(u.actualUsageAmount ?? 0)} of ${num(u.limit ?? 0)} ${u.unit ?? ""}`} />
      ))}
    </ul>
    {!usage.freeTierUsages?.length && <p className="mt-4 text-sm text-zinc-500">No free tier usage recorded this month yet. Lambda and CloudFront show up here once the site runs on AWS.</p>}
  </>);
}

export default function Backend() {
  return (
    <BackendShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-10 pb-16">
        <div className="flex items-center justify-between py-6">
          <h1 className="text-4xl font-bold">Backend</h1>
          <Link href="/profile" className="rounded-full px-5 py-2 border border-zinc-200 dark:border-zinc-800 hover:opacity-80">← Back</Link>
        </div>
        <p className="-mt-2 mb-8 text-zinc-500">How much of each free plan willy.work is using.</p>
        <div className="flex flex-col gap-6">
          <Card title="MongoDB Atlas" plan="M0 free cluster"><Suspense fallback={<Loading />}><Mongo /></Suspense></Card>
          <Card title="AWS" plan="Free plan · us-east-2"><Suspense fallback={<Loading />}><Aws /></Suspense></Card>
          {/* ponytail: nothing to measure yet; wire up their APIs once they carry traffic */}
          <Card title="Cloudflare" plan="Free plan · DNS only">
            <p className="text-sm text-zinc-500">DNS on the free plan has no usage cap, so there&apos;s nothing to run out of.</p>
          </Card>
          <Card title="Oracle Cloud" plan="Always Free VM · headscale">
            <p className="text-sm text-zinc-500">Always Free resources are a fixed allocation (no monthly meter) except 10 TB of outbound data a month.</p>
          </Card>
        </div>
      </div>
    </BackendShell>
  );
}
