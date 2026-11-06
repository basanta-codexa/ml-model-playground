import Panel from "./Panel";

export default function MissingBars({ columns }) {
    const gaps = columns
        .filter((c) => c.missing > 0)
        .sort((a, b) => b.missing_pct - a.missing_pct)
        .slice(0, 10);

    return (
        <Panel
            title="Missing values"
            subtitle="Empty cells per column."
            className="h-full"
        >
            {gaps.length === 0 ? (
                <p className="rounded-lg border border-ok/30 bg-ok-soft px-4 py-5 text-sm text-ok">
                    No missing values. Nothing to fix here.
                </p>
            ) : (
                <ul className="space-y-3">
                    {gaps.map((c) => (
                        <li key={c.name}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="truncate text-ink/90">{c.name}</span>
                                <span className="tnum shrink-0 text-muted">
                                    {c.missing} <span className="text-xs">({c.missing_pct}%)</span>
                                </span>
                            </div>
                            <div
                                role="presentation"
                                className="h-1.5 overflow-hidden rounded-full bg-line"
                            >
                                <div
                                    className={`h-full rounded-full ${c.missing_pct > 30 ? "bg-bad/80" : "bg-warn"}`}
                                    style={{ width: `${Math.max(c.missing_pct, 1.5)}%` }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
