import Panel from "./Panel";
import FoldChart from "./FoldChart";
import ConfusionMatrix from "./ConfusionMatrix";

const toneStyle = { good: "text-ok", mid: "text-warn", bad: "text-bad" };

function fmt(value, digits = 1) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function count(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : "—";
}

function Stat({ label, value }) {
    return (
        <div className="rounded-md bg-canvas px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
            <div className="tnum mt-1 text-sm text-ink">{value}</div>
        </div>
    );
}

function RunNotes({ result }) {
    const notes = [];
    if (result.cv_auc) {
        const kind = result.class_names?.length === 2 ? "binary" : "one-vs-rest, macro";
        notes.push(`AUC (${kind}): ${fmt(result.cv_auc.mean, 3)} ± ${fmt(result.cv_auc.std, 3)}`);
    }
    if (result.class_weight) {
        notes.push("Target was imbalanced, so the classes were weighted equally");
    }
    if (result.tuned?.params) {
        const params = Object.entries(result.tuned.params)
            .map(([k, v]) => `${k}=${v === null ? "none" : v}`)
            .join(", ");
        notes.push(`tuned: ${params}`);
    }
    if (notes.length === 0) return null;
    return <p className="mt-3 text-xs text-muted">{notes.join(" · ")}</p>;
}

function PerClassTable({ rows }) {
    if (!rows?.length) return null;
    return (
        <div className="mt-4 overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="border-b border-line text-muted">
                        <th className="px-3 py-2 font-medium">Class</th>
                        <th className="px-3 py-2 font-medium">Precision</th>
                        <th className="px-3 py-2 font-medium">Recall</th>
                        <th className="px-3 py-2 font-medium">F1</th>
                        <th className="px-3 py-2 font-medium">Rows</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.label} className="border-b border-line/60 last:border-0">
                            <td className="px-3 py-2">{r.label}</td>
                            <td className="tnum px-3 py-2 text-muted">{fmt(r.precision)}%</td>
                            <td className="tnum px-3 py-2 text-muted">{fmt(r.recall)}%</td>
                            <td className="tnum px-3 py-2 text-muted">{fmt(r.f1)}%</td>
                            <td className="tnum px-3 py-2 text-muted">{count(r.support)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Verdict({ verdict }) {
    const v = verdict || {};
    return (
        <p className="mt-3 text-sm leading-relaxed">
            <strong className={toneStyle[v.tone] || ""}>{v.title || "Result"}.</strong>{" "}
            <span className="text-muted">{v.text}</span>
        </p>
    );
}

function ClassificationResult({ result, headline, baseline }) {
    const rows = [
        ["Always guess the most common class", baseline],
        ["Training rows", result.train_accuracy],
        ["Single held-out split", result.test_accuracy],
    ];

    return (
        <>
            <Panel
                title="Accuracy"
                subtitle={result.cv ? "Averaged over several splits of the data." : "On the held-out rows."}
            >
                <p className="text-3xl font-semibold text-ink">{headline.toFixed(1)}%</p>
                <p className="mt-1 text-sm text-muted">
                    {count(result.correct)} of {count(result.test_rows)} correct
                </p>
                <table className="mt-4 w-full text-left text-sm">
                    <tbody>
                        {rows.map(([label, value]) => (
                            <tr key={label} className="border-b border-line/60 last:border-0">
                                <td className="py-1.5 text-muted">{label}</td>
                                <td className="tnum py-1.5 text-right">{fmt(value)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Verdict verdict={result.verdict} />
            </Panel>

            <RunNotes result={result} />

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Training time" value={`${count(result.fit_ms)} ms`} />
                <Stat label="Test rows" value={count(result.test_rows)} />
                <Stat label="One mistake moves the score by" value={`${fmt(result.points_per_row)} pts`} />
            </dl>

            <PerClassTable rows={result.per_class} />
            <ConfusionMatrix matrix={result.confusion_matrix} classNames={result.class_names} />
        </>
    );
}

function RegressionResult({ result, headline }) {
    const improvement =
        typeof result.baseline_mae === "number" && result.baseline_mae > 0 &&
        typeof result.mae === "number"
            ? Math.round((1 - result.mae / result.baseline_mae) * 100)
            : null;

    return (
        <>
            <Panel title="R-squared" subtitle="Share of the variation the model accounts for.">
                <p className="text-3xl font-semibold text-ink">{headline.toFixed(2)}</p>
                <table className="mt-4 w-full text-left text-sm">
                    <tbody>
                        <tr className="border-b border-line/60">
                            <td className="py-1.5 text-muted">Mean absolute error</td>
                            <td className="tnum py-1.5 text-right">{fmt(result.mae, 2)}</td>
                        </tr>
                        <tr className="border-b border-line/60">
                            <td className="py-1.5 text-muted">Baseline mean absolute error</td>
                            <td className="tnum py-1.5 text-right">{fmt(result.baseline_mae, 2)}</td>
                        </tr>
                        <tr className="border-b border-line/60">
                            <td className="py-1.5 text-muted">Root mean squared error</td>
                            <td className="tnum py-1.5 text-right">{fmt(result.rmse, 2)}</td>
                        </tr>
                        <tr>
                            <td className="py-1.5 text-muted">Better than the average</td>
                            <td className="tnum py-1.5 text-right">
                                {improvement === null ? "—" : `${improvement}%`}
                            </td>
                        </tr>
                    </tbody>
                </table>
                <Verdict verdict={result.verdict} />
            </Panel>

            <RunNotes result={result} />

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Training time" value={`${count(result.fit_ms)} ms`} />
                <Stat label="Test rows" value={count(result.test_rows)} />
                <Stat label="Average target" value={fmt(result.target_mean, 2)} />
            </dl>
        </>
    );
}

export default function TrainResult({ result }) {
    const isRegression = result.task === "regression";
    const raw = result.cv ? result.cv.mean : isRegression ? result.test_r2 : result.test_accuracy;
    const headline = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    const baseline = result.cv ? result.cv_baseline?.mean : result.baseline_accuracy;

    return (
        <div className="mt-8">
            <h3 className="text-base font-semibold text-ink">{result.label}</h3>
            <p className="mt-1 text-sm text-muted">
                {result.cv
                    ? `Cross-validated over ${result.cv.n_splits} folds; ${count(result.test_rows)} held-out rows.`
                    : `${count(result.test_rows)} held-out rows.`}
            </p>

            {isRegression ? (
                <RegressionResult result={result} headline={headline} />
            ) : (
                <ClassificationResult result={result} headline={headline} baseline={baseline} />
            )}

            <FoldChart
                cv={result.cv}
                cvBaseline={result.cv_baseline}
                holdout={isRegression ? result.test_r2 : result.test_accuracy}
            />
        </div>
    );
}
