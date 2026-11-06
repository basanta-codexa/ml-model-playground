import { Suspense, lazy, useEffect, useState } from "react";
import Panel from "./Panel";
import MissingBars from "./MissingBars";
import ClassBalance from "./ClassBalance";
import { getProfile } from "../api";

// Recharts is the heaviest dependency in the bundle, so the chart loads on
// demand instead of on first paint.
const ColumnExplorer = lazy(() => import("./ColumnExplorer"));

const levelStyle = {
    warn: "border-warn bg-warn-soft text-warn",
    info: "border-accent bg-accent-soft text-accent",
};

export default function DataProfile({ dataset }) {
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        getProfile(dataset.dataset_id)
            .then((p) => !cancelled && setProfile(p))
            .catch((e) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
    }, [dataset.dataset_id]);

    if (error) {
        return (
            <p className="mt-10 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
                {error}
            </p>
        );
    }

    if (!profile) {
        return (
            <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-40 animate-pulse rounded-xl border border-line bg-surface" />
                ))}
            </div>
        );
    }

    const completePct = Math.round((profile.complete_rows / profile.rows) * 100);

    return (
        <div className="mt-10">
            <div className="border-b border-line pb-3">
                <h2 className="text-2xl font-bold tracking-tight text-ink">What&rsquo;s in your data</h2>
                <p className="mt-1 text-sm text-muted">Automatic checks before anything is modelled.</p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Panel title="Data health" subtitle="Rows with no missing values." className="h-full">
                    <div className="flex items-end justify-between">
                        <span className="tnum text-5xl font-bold tracking-tight text-ink">{completePct}%</span>
                        <span className="text-xs font-medium uppercase tracking-wider text-muted">complete</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="presentation">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${completePct}%` }} />
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted">Missing cells</dt>
                            <dd className="tnum font-semibold text-ink">
                                {profile.missing_cells} <span className="font-normal text-muted">({profile.missing_pct}%)</span>
                            </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted">Duplicate rows</dt>
                            <dd className="tnum font-semibold text-ink">{profile.duplicate_rows}</dd>
                        </div>
                    </dl>
                </Panel>

                <Panel
                    title="Things to know"
                    subtitle="What a careful analyst would flag."
                    className="h-full md:col-span-2"
                >
                    {profile.warnings.length === 0 ? (
                        <p className="rounded-lg border border-ok/30 bg-ok-soft px-4 py-4 text-sm text-ok">
                            No red flags found. This dataset looks clean.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {profile.warnings.map((w) => (
                                <li
                                    key={w.title}
                                    className={`rounded-lg border-l-4 px-4 py-3 text-sm ${levelStyle[w.level]}`}
                                >
                                    <span className="font-semibold">{w.title}. </span>
                                    <span className="text-ink/80">{w.text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
                <MissingBars columns={profile.columns} />
                <ClassBalance columns={profile.columns} defaultTarget={dataset.suggested_target} />
            </div>

            <div className="mt-4">
                <Suspense fallback={<div className="h-72 animate-pulse rounded-xl border border-line bg-surface" />}>
                    <ColumnExplorer columns={profile.columns} />
                </Suspense>
            </div>
        </div>
    );
}
