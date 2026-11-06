import Panel from "./Panel";
import FoldChart from "./FoldChart";
import ConfusionMatrix from "./ConfusionMatrix";

const toneStyle = {
    good: "border-ok bg-ok-soft text-ok",
    mid: "border-warn bg-warn-soft text-warn",
    bad: "border-bad bg-bad-soft text-bad",
};

const BASELINE = "#cbd5e1";
const TRAIN = "#94a3b8";
const CV = "#2563eb";
const HOLDOUT = "#93c5fd";

function Bar({ label, value, max, color, suffix = "%" }) {
    const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const ceiling = typeof max === "number" && max > 0 ? max : Math.max(safe, 1);
    const width = Math.max(0, Math.min(100, (safe / ceiling) * 100));
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink/90">{label}</span>
                <span className="tnum shrink-0 text-muted">
                    {typeof value === "number" && Number.isFinite(value)
                        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "—"}
                    {suffix}
                </span>
            </div>
            <div role="presentation" className="h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ background: color, width: `${width}%` }} />
            </div>
        </div>
    );
}

function StatBlock({ label, value, sub }) {
    return (
        <div className="rounded-lg bg-canvas px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
            <div className="tnum mt-1 text-lg font-bold text-ink">{value}</div>
            {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
        </div>
    );
}

function Verdict({ tone, title, text }) {
    const style = toneStyle[tone] || toneStyle.mid;
    return (
        <div className={`mt-4 rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed ${style}`}>
            <span className="font-semibold">{title}.</span> {text}
        </div>
    );
}

/** The result of training a classifier: how often it was right. */
function ClassificationResult({ result, headline, baseline }) {
    const mistakes = result.test_rows - result.correct;
    const v = result.verdict;

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <Panel
                    title="Accuracy"
                    subtitle={result.cv ? "Averaged over several splits of the data." : "On the held-out test rows."}
                    className="h-full"
                >
                    <div className="tnum text-6xl font-bold tracking-tight text-ink">
                        {headline.toFixed(1)}
                        <span className="text-2xl text-muted">%</span>
                    </div>
                    <p className="mt-3 text-sm text-muted">
                        {result.correct} of {result.test_rows} correct
                        {mistakes > 0 ? ` · ${mistakes} wrong` : " · none wrong"}
                    </p>
                    {result.cv && (
                        <p className="tnum mt-1 text-xs text-muted">
                            on the single held-out split: {result.test_accuracy}%
                        </p>
                    )}
                </Panel>

                <Panel
                    title="Is that good?"
                    subtitle="A score only means something next to a baseline."
                    className="h-full md:col-span-2"
                >
                    <div className="space-y-3">
                        <Bar label="Always guess the most common class" value={baseline} color={BASELINE} />
                        <Bar label="Training rows (it studied these)" value={result.train_accuracy} color={TRAIN} />
                        {result.cv && (
                            <Bar
                                label={`Cross-validated (${result.cv.n_splits} folds — the one to trust)`}
                                value={result.cv.mean}
                                color={CV}
                            />
                        )}
                        <Bar label="One held-out split (noisier)" value={result.test_accuracy} color={HOLDOUT} />
                    </div>
                    <Verdict tone={v.tone} title={v.title} text={v.text} />
                </Panel>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <StatBlock label="Training time" value={`${result.fit_ms} ms`} />
                <StatBlock label="Test rows" value={result.test_rows} />
                <StatBlock
                    label="One mistake moves the score by"
                    value={`${result.points_per_row} pts`}
                    sub={result.test_rows < 50 ? "Few test rows — treat this score as rough." : undefined}
                />
            </div>

            <ConfusionMatrix matrix={result.confusion_matrix} classNames={result.class_names} />
        </>
    );
}

/** The result of training a regressor: how close its guesses were. */
function RegressionResult({ result, headline }) {
    const v = result.verdict;
    const r2Percent = Math.max(0, Math.round(headline * 100));
    const improvement = result.baseline_mae > 0
        ? Math.round((1 - result.mae / result.baseline_mae) * 100)
        : 0;
    const maxErr = Math.max(result.baseline_mae, result.rmse, 1);

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <Panel
                    title="How much it explains"
                    subtitle="R-squared: the share of the variation it accounts for."
                    className="h-full"
                >
                    <div className="tnum text-6xl font-bold tracking-tight text-ink">
                        {headline.toFixed(2)}
                    </div>
                    <p className="mt-3 text-sm text-muted">
                        {headline >= 0
                            ? `Explains ${r2Percent}% of the variation`
                            : "Worse than guessing the average"}
                    </p>
                    {result.cv && (
                        <p className="tnum mt-1 text-xs text-muted">
                            single split: {result.test_r2.toFixed(3)}
                        </p>
                    )}
                </Panel>

                <Panel
                    title="How far off is it?"
                    subtitle="Compared with always guessing the average."
                    className="h-full md:col-span-2"
                >
                    <div className="space-y-3">
                        <Bar label="Always guess the average" value={result.baseline_mae} max={maxErr} color={BASELINE} suffix="" />
                        <Bar label="This model" value={result.mae} max={maxErr} color={CV} suffix="" />
                    </div>
                    <Verdict tone={v.tone} title={v.title} text={v.text} />
                </Panel>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <StatBlock label="Training time" value={`${result.fit_ms} ms`} />
                <StatBlock label="Test rows" value={result.test_rows} />
                <StatBlock label="Average target" value={result.target_mean?.toLocaleString()} />
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <StatBlock
                    label="Mean absolute error"
                    value={result.mae.toLocaleString()}
                    sub="off by this much on a typical row"
                />
                <StatBlock
                    label="Root mean squared error"
                    value={result.rmse.toLocaleString()}
                    sub="punishes big misses more"
                />
                <StatBlock
                    label="Better than the average"
                    value={`${improvement}%`}
                    sub="smaller error than guessing"
                />
            </div>
        </>
    );
}

export default function TrainResult({ result }) {
    const isRegression = result.task === "regression";
    const rawHeadline = result.cv
        ? result.cv.mean
        : isRegression
            ? result.test_r2
            : result.test_accuracy;
    // A missing or garbage number must never take the page down.
    const headline = typeof rawHeadline === "number" && Number.isFinite(rawHeadline) ? rawHeadline : 0;

    return (
        <div className="mt-8">
            <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
                <span
                    aria-hidden="true"
                    className="grid h-8 w-8 place-items-center rounded-full bg-ok-soft text-sm font-bold text-ok"
                >
                    ✓
                </span>
                <div>
                    <div className="text-lg font-bold tracking-tight text-ink">{result.label} is trained</div>
                    <div className="text-sm text-muted">
                        {result.cv
                            ? `Cross-validated over ${result.cv.n_splits} folds, and scored on ${result.test_rows} held-back rows.`
                            : `Scored on ${result.test_rows} rows it has never seen.`}
                    </div>
                </div>
            </div>

            {isRegression
                ? <RegressionResult result={result} headline={headline} />
                : <ClassificationResult
                    result={result}
                    headline={headline}
                    baseline={result.cv ? result.cv_baseline?.mean : result.baseline_accuracy}
                />}

            <FoldChart
                cv={result.cv}
                cvBaseline={result.cv_baseline}
                holdout={isRegression ? result.test_r2 : result.test_accuracy}
            />
        </div>
    );
}
