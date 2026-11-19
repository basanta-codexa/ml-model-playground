import Panel from "./Panel";
import ColumnDecisions from "./ColumnDecisions";

export default function PrepResult({ result, stale }) {
    const isRegression = result.task === "regression";
    const stats = isRegression
        ? [
              ["Training rows", result.train_rows],
              ["Test rows", result.test_rows],
              ["Target", result.target],
          ]
        : [
              ["Training rows", result.train_rows],
              ["Test rows", result.test_rows],
              ["Classes", result.n_classes],
          ];
    const classSplit = result.class_split || [];

    return (
        <div className={`mt-8 ${stale ? "opacity-60" : ""}`}>
            <h2 className="border-b border-line pb-3 text-lg font-semibold text-ink">
                Prepared data
            </h2>
            {stale && (
                <p className="mt-2 text-sm text-warn">
                    Settings changed since this run. Prepare again to refresh.
                </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
                {stats.map(([label, value]) => (
                    <div key={label} className="bg-surface px-3 py-2">
                        <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
                        <dd className="tnum mt-1 text-lg text-ink">{value}</dd>
                    </div>
                ))}
                <div className="bg-surface px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted">Features</dt>
                    <dd className="tnum mt-1 text-lg text-ink">
                        {result.features_before} → {result.features_after}
                    </dd>
                </div>
            </dl>

            {result.warnings.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm">
                    {result.warnings.map((w) => (
                        <li key={w.title} className="leading-relaxed">
                            <span className="font-semibold text-ink">{w.title}. </span>
                            <span className="text-muted">{w.text}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Panel title="Steps" subtitle="In the order they were applied.">
                    <ol className="list-decimal space-y-3 pl-5 text-sm">
                        {result.steps.map((s) => (
                            <li key={s.key} className="leading-relaxed">
                                <span className="font-medium text-ink">{s.title}. </span>
                                <span className="text-muted">{s.detail}</span>{" "}
                                <span className="text-muted">Why: {s.why}</span>
                            </li>
                        ))}
                    </ol>
                </Panel>

                {isRegression ? (
                    <Panel title="Target" subtitle="A number, so there are no classes.">
                        <p className="text-sm leading-relaxed text-muted">
                            Rows were split at random. Scoring uses R-squared and the error in the
                            same unit as the target.
                        </p>
                        <p className="mt-3 text-sm text-ink">{result.target}</p>
                    </Panel>
                ) : (
                    <Panel
                        title="Split by class"
                        subtitle={result.stratified ? "Stratified split." : "Random split."}
                    >
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-line text-xs text-muted">
                                    <th className="py-1.5 font-medium">Class</th>
                                    <th className="py-1.5 font-medium">Train</th>
                                    <th className="py-1.5 font-medium">Test</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classSplit.map((c) => (
                                    <tr key={c.label} className="border-b border-line/60 last:border-0">
                                        <td className="py-1.5">{c.label}</td>
                                        <td className="tnum py-1.5">{c.train}</td>
                                        <td className="tnum py-1.5">{c.test}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Panel>
                )}
            </div>

            <ColumnDecisions columns={result.columns} leaked={result.leaked_columns || []} />
        </div>
    );
}
