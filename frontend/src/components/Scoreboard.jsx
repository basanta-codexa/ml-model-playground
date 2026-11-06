import Panel from "./Panel";

/**
 * The running leaderboard. Models are ranked by their cross-validated
 * score when we have one — a single split can move by several points and
 * would make the ranking a lottery. The spread is shown next to each score.
 */
export default function Scoreboard({ results }) {
    if (!results || results.length === 0) return null;

    const isRegression = results[0].task === "regression";

    const scoreOf = (r) => (r.cv ? r.cv.mean : isRegression ? r.test_r2 : r.test_accuracy);
    const sorted = [...results].sort((a, b) => scoreOf(b) - scoreOf(a));

    // Negative R-squared is worse than the average, so the bar floor is 0.
    const best = Math.max(...sorted.map(scoreOf), isRegression ? 0 : 100);
    const floor = Math.min(0, ...sorted.map(scoreOf));

    const format = (value) => (isRegression ? value.toFixed(3) : `${value.toFixed(1)}%`);

    return (
        <Panel
            title="Scoreboard"
            subtitle={
                isRegression
                    ? "Cross-validated R-squared of every model you've trained."
                    : "Cross-validated accuracy of every model you've trained."
            }
            className="mt-6"
        >
            <ul className="space-y-3">
                {sorted.map((r, i) => {
                    const score = scoreOf(r);
                    const width = best > floor ? ((score - floor) / (best - floor)) * 100 : 0;
                    return (
                        <li key={r.model_id}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2 text-ink/90">
                                    {r.label}
                                    {i === 0 && sorted.length > 1 && (
                                        <span className="rounded border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                                            best so far
                                        </span>
                                    )}
                                </span>
                                <span className="tnum shrink-0 text-muted">
                                    {format(score)}
                                    {r.cv && (
                                        <span className="ml-1.5 text-xs">± {r.cv.std.toFixed(1)}</span>
                                    )}
                                </span>
                            </div>
                            <div
                                role="presentation"
                                className="h-2 overflow-hidden rounded-full bg-line"
                            >
                                <div
                                    className="h-full rounded-full bg-accent"
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}
