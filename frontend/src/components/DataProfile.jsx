import { Suspense, lazy, useEffect, useState } from "react";
import Panel from "./Panel";
import MissingBars from "./MissingBars";
import ClassBalance from "./ClassBalance";
import { getProfile } from "../api";

const ColumnExplorer = lazy(() => import("./ColumnExplorer"));

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

    if (error) return <p className="mt-10 text-sm text-bad">{error}</p>;
    if (!profile) return <p className="mt-10 text-sm text-muted">Loading profile…</p>;

    const completePct = Math.round((profile.complete_rows / profile.rows) * 100);

    return (
        <div className="mt-10">
            <h2 className="border-b border-line pb-3 text-lg font-semibold text-ink">
                Dataset profile
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Panel title="Data health" subtitle="Rows with no missing values." className="h-full">
                    <p className="text-2xl font-semibold text-ink">{completePct}% complete</p>
                    <dl className="mt-3 space-y-1 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted">Missing cells</dt>
                            <dd className="tnum text-ink">
                                {profile.missing_cells} ({profile.missing_pct}%)
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted">Duplicate rows</dt>
                            <dd className="tnum text-ink">{profile.duplicate_rows}</dd>
                        </div>
                    </dl>
                </Panel>

                <Panel title="Checks" subtitle="Findings before modelling." className="h-full md:col-span-2">
                    {profile.warnings.length === 0 ? (
                        <p className="text-sm text-muted">No warnings.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {profile.warnings.map((w) => (
                                <li key={w.title} className="leading-relaxed">
                                    <span className="font-semibold text-ink">{w.title}. </span>
                                    <span className="text-muted">{w.text}</span>
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
                <Suspense fallback={<p className="text-sm text-muted">Loading column details…</p>}>
                    <ColumnExplorer columns={profile.columns} />
                </Suspense>
            </div>
        </div>
    );
}
