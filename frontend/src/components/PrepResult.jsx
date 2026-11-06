import Panel from "./Panel";
import ColumnDecisions from "./ColumnDecisions";

function fmt(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isInteger(value) ? value : Number(value.toFixed(3));
    return String(value);
}

function MiniTable({ columns, rows, hidden = 0 }) {
    return (
        <div>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-line text-muted">
                            {columns.map((c) => (
                                <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="border-b border-line/60 last:border-0">
                                {row.map((cell, j) => {
                                    const value = fmt(cell);
                                    return (
                                        <td key={j} className="tnum whitespace-nowrap px-3 py-1.5 text-ink/90">
                                            {value === null
                                                ? <span className="text-xs italic text-bad/80">missing</span>
                                                : value}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hidden > 0 && <p className="mt-1.5 text-xs text-muted">+ {hidden} more columns not shown</p>}
        </div>
    );
}

const levelStyle = {
    warn: "border-warn bg-warn-soft text-warn",
    info: "border-accent bg-accent-soft text-accent",
};

export default function PrepResult({ result, stale }) {
    const isRegression = result.task === "regression";
    const stats = isRegression
        ? [
            { label: "Training rows", value: result.train_rows },
            { label: "Test rows", value: result.test_rows },
            { label: "Predicting", value: result.target },
        ]
        : [
            { label: "Training rows", value: result.train_rows },
            { label: "Test rows", value: result.test_rows },
            { label: "Classes", value: result.n_classes },
        ];
    const classSplit = result.class_split || [];
    const maxClass = Math.max(...classSplit.map((c) => c.train + c.test), 1);

    // Raw rows are objects keyed by column name; the tables want arrays of cells
    const beforeRows = result.before.rows.map((r) => result.before.columns.map((c) => r[c]));

    return (
        <div className={`mt-8 ${stale ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-3 border-b border-line pb-4">
                <span
                    aria-hidden="true"
                    className="grid h-8 w-8 place-items-center rounded-full bg-ok-soft text-sm font-bold text-ok"
                >
                    ✓
                </span>
                <div>
                    <div className="text-lg font-bold tracking-tight text-ink">Your data is ready for training</div>
                    <div className="text-sm text-muted">
                        {stale
                            ? "These results are out of date. Prepare again to refresh."
                            : "Here is exactly what happened, in order."}
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className="bg-surface px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{s.label}</div>
                        <div className="tnum mt-1 truncate text-2xl font-bold text-ink">
                            {s.value}
                        </div>
                    </div>
                ))}
                <div className="bg-surface px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Features</div>
                    <div className="tnum mt-1 text-2xl font-bold text-ink">
                        {result.features_before}
                        <span aria-hidden="true" className="mx-1.5 text-muted">→</span>
                        <span className="text-accent">{result.features_after}</span>
                    </div>
                </div>
            </div>

            {result.warnings.length > 0 && (
                <ul className="mt-4 space-y-2">
                    {result.warnings.map((w) => (
                        <li
                            key={w.title}
                            className={`rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed ${levelStyle[w.level]}`}
                        >
                            <span className="font-semibold">{w.title}.</span>{" "}
                            <span className="text-ink/80">{w.text}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="What we did" subtitle="In order, with the reason for each step." className="h-full">
                    <ol className="relative ml-3 border-l border-line">
                        {result.steps.map((s, i) => (
                            <li key={s.key} className="relative mb-4 ml-6 last:mb-0">
                                <span
                                    aria-hidden="true"
                                    className="tnum absolute -left-[31px] top-0 grid h-5 w-5 place-items-center rounded-full border border-line bg-surface text-[10px] font-bold text-muted"
                                >
                                    {i + 1}
                                </span>
                                <div className="text-sm font-semibold text-ink">{s.title}</div>
                                <div className="mt-0.5 text-sm leading-snug text-ink/80">{s.detail}</div>
                                <div className="mt-1 text-xs italic text-muted">Why: {s.why}</div>
                            </li>
                        ))}
                    </ol>
                </Panel>

                {isRegression ? (
                    <Panel
                        title="What the model is predicting"
                        subtitle="A number, so there are no classes to split."
                        className="h-full"
                    >
                        <p className="text-sm leading-relaxed text-muted">
                            The target is a quantity, so the rows were split at random
                            rather than keeping class ratios. Scoring uses R-squared and
                            the size of the errors, in the same unit as the target.
                        </p>
                        <div className="mt-4 rounded-lg bg-canvas px-4 py-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Target column</div>
                            <div className="mt-1 text-lg font-bold text-ink">{result.target}</div>
                        </div>
                    </Panel>
                ) : (
                    <Panel
                        title="Split by class"
                        subtitle={
                            result.stratified
                                ? "Stratified: every class keeps the same ratio in train and test."
                                : "Random split: class ratios may differ between train and test."
                        }
                        className="h-full"
                    >
                        <div className="mb-3 flex gap-4 text-xs text-muted">
                            <span className="flex items-center gap-1.5">
                                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-accent" /> Train
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-zinc-300" /> Test
                            </span>
                        </div>
                        <ul className="space-y-3">
                            {classSplit.map((c) => (
                                <li key={c.label}>
                                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                        <span className="truncate text-ink/90">{c.label}</span>
                                        <span className="tnum shrink-0 text-muted">
                                            {c.train} train · {c.test} test
                                        </span>
                                    </div>
                                    <div role="presentation" className="h-2 overflow-hidden rounded-full bg-line">
                                        <div
                                            className="flex h-full"
                                            style={{ width: `${((c.train + c.test) / maxClass) * 100}%` }}
                                        >
                                            <div className="h-full bg-accent" style={{ flex: c.train }} />
                                            <div className="h-full bg-zinc-300" style={{ flex: c.test }} />
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}
            </div>

            <ColumnDecisions
                columns={result.columns}
                leaked={result.leaked_columns || []}
            />

            <Panel
                title="Before and after"
                subtitle="The same first training rows. Raw on top, model-ready below."
                className="mt-4"
            >
                <div className="space-y-4">
                    <div>
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                            Before (raw)
                        </div>
                        <MiniTable columns={result.before.columns} rows={beforeRows} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                            After (numbers only)
                        </div>
                        <MiniTable
                            columns={result.after.columns}
                            rows={result.after.rows}
                            hidden={result.after.hidden_columns}
                        />
                    </div>
                </div>
            </Panel>
        </div>
    );
}
