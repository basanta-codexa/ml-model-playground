import { useEffect, useState } from "react";
import TrainResult from "./TrainResult";
import { getHistory, getHistoryRun } from "../api";

function formatScore(run) {
    if (run.cv_mean == null) {
        return run.task === "regression"
            ? `R² ${run.test_r2?.toFixed(3) ?? "—"}`
            : `${run.test_accuracy?.toFixed(1) ?? "?"}%`;
    }
    return run.cv_metric === "r2"
        ? `R² ${run.cv_mean.toFixed(3)}`
        : `${run.cv_mean.toFixed(1)}%`;
}

function formatDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function History() {
    const [runs, setRuns] = useState(null);
    const [error, setError] = useState("");
    const [open, setOpen] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [loadingId, setLoadingId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getHistory(10)
            .then((list) => !cancelled && setRuns(list))
            .catch((e) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
    }, []);

    async function toggle(id) {
        if (open === id) {
            setOpen(null);
            setExpanded(null);
            return;
        }
        setLoadingId(id);
        try {
            const run = await getHistoryRun(id);
            setOpen(id);
            setExpanded(run);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingId(null);
        }
    }

    return (
        <section className="mt-10">
            <h2 className="border-b border-line pb-3 text-lg font-semibold text-ink">
                Recent runs
            </h2>

            {error && <p className="mt-2 text-sm text-warn">History unavailable — {error}</p>}
            {runs === null && <p className="mt-2 text-sm text-muted">Loading history…</p>}
            {runs?.length === 0 && (
                <p className="mt-2 text-sm text-muted">No saved runs.</p>
            )}

            {runs?.length > 0 && (
                <ul className="mt-2 divide-y divide-line border-y border-line">
                    {runs.map((run) => (
                        <li key={run.id} className="py-2">
                            <button
                                type="button"
                                onClick={() => toggle(run.id)}
                                aria-expanded={open === run.id}
                                className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left text-sm"
                            >
                                <span>
                                    <span className="font-medium text-ink">{run.label}</span>
                                    <span className="ml-2 text-xs text-muted">on {run.dataset}</span>
                                    {run.tune && (
                                        <span className="ml-2 text-xs text-muted">(tuned)</span>
                                    )}
                                </span>
                                <span className="flex items-baseline gap-3">
                                    <span className="tnum">{formatScore(run)}</span>
                                    <span className="tnum text-xs text-muted">
                                        {formatDate(run.created_at)}
                                    </span>
                                    <span className="text-xs text-muted">
                                        {loadingId === run.id ? "…" : open === run.id ? "−" : "+"}
                                    </span>
                                </span>
                            </button>

                            {open === run.id && expanded && (
                                <div className="mt-3 border-t border-line pt-3">
                                    <TrainResult result={expanded.result} />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
