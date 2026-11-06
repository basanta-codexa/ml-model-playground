import { useState } from "react";
import { preprocess } from "../api";
import Panel from "./Panel";
import Segmented from "./Segmented";
import PrepResult from "./PrepResult";
import TargetPicker from "./TargetPicker";

const scalingHelp = {
    standard: "Shifts each column to mean 0 and spread 1. The usual default.",
    minmax: "Squeezes each column into the range 0 to 1.",
    none: "Leaves numbers as they are. Fine for tree models, risky for KNN and logistic regression.",
};

const cardinalityHelp = {
    group_rare:
        "Values that appear only a few times (under 1% of the rows, capped at your limit) are rolled into one 'other' bucket. A thousand one-off names become a handful of useful columns.",
    drop: "A column with hundreds of one-off values is left out entirely.",
    keep: "Every value gets its own column. Honest, but it can make a thousand almost-empty columns.",
};

// Constant columns and columns unique on every row are pre-selected to be
// dropped. A feature that is different on every row teaches memorising, not
// generalising.
function suggestDrops(dataset, target) {
    return (dataset.columns || [])
        .filter((c) => c.name !== target && (c.unique <= 1 || c.unique === dataset.rows))
        .map((c) => c.name);
}

function Label({ title, hint }) {
    return (
        <div className="mb-1.5">
            <div className="text-sm font-semibold text-ink">{title}</div>
            {hint && <div className="mt-0.5 text-xs leading-snug text-muted">{hint}</div>}
        </div>
    );
}

const chipBase = "rounded-md border px-2.5 py-1 text-xs transition-colors";
const chipOn = "border-accent bg-accent-soft text-accent";
const chipOff = "border-line bg-surface text-muted line-through decoration-line";

export default function Preprocessing({ dataset, onPrepared }) {
    const columns = dataset.columns || [];
    const suggestions = dataset.target_suggestions || [];
    const firstTarget =
        suggestions.find((s) => s.name === dataset.suggested_target)?.name ??
        suggestions[0]?.name ??
        columns[0]?.name ??
        "";

    const [config, setConfig] = useState({
        target: firstTarget,
        task: "auto",
        dropped: suggestDrops(dataset, firstTarget),
        numericImpute: "median",
        categoricalImpute: "most_frequent",
        scaling: "standard",
        testSize: 0.2,
        stratify: true,
        randomState: 42,
        highCardinality: "group_rare",
        maxCategories: 50,
        rareThreshold: 20,
        parseNumbers: true,
        dropLeaky: true,
        cvFolds: 5,
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stale, setStale] = useState(false);

    function update(patch) {
        setConfig((c) => {
            const next = { ...c, ...patch };
            // the target can't also be a dropped column
            if (patch.target) next.dropped = next.dropped.filter((n) => n !== patch.target);
            return next;
        });
        if (result) setStale(true);
    }

    function toggleDrop(name) {
        const dropped = config.dropped.includes(name)
            ? config.dropped.filter((n) => n !== name)
            : [...config.dropped, name];
        update({ dropped });
    }

    async function run() {
        setLoading(true);
        setError("");
        try {
            const res = await preprocess(dataset.dataset_id, {
                target: config.target,
                task: config.task,
                drop_columns: config.dropped,
                numeric_impute: config.numericImpute,
                categorical_impute: config.categoricalImpute,
                scaling: config.scaling,
                test_size: config.testSize,
                stratify: config.stratify,
                random_state: config.randomState,
                high_cardinality: config.highCardinality,
                max_categories: config.maxCategories,
                rare_threshold: config.rareThreshold,
                parse_numbers: config.parseNumbers,
                drop_leaky: config.dropLeaky,
                cv_folds: config.cvFolds,
            });
            setResult(res);
            setStale(false);
            onPrepared?.(res);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const trainPct = Math.round((1 - config.testSize) * 100);
    const testPct = 100 - trainPct;

    return (
        <div className="mt-12">
            <div className="border-b border-line pb-3">
                <h2 className="text-2xl font-bold tracking-tight text-ink">Prepare the data</h2>
                <p className="mt-1 text-sm text-muted">
                    Choose what to predict and how to clean it — nothing happens silently.
                </p>
            </div>

            <div className="mt-4 space-y-4">
                <TargetPicker
                    dataset={dataset}
                    task={config.task}
                    onTask={(task) => update({ task })}
                    value={config.target}
                    onChange={(target) => update({ target })}
                />

                <Panel title="Features" subtitle="Click a column to leave it out.">
                    <div className="flex flex-wrap gap-1.5">
                        {columns
                            .filter((c) => c.name !== config.target)
                            .map((c) => {
                                const off = config.dropped.includes(c.name);
                                const hint = [
                                    c.kind === "numeric" ? "numbers" : "labels",
                                    c.unit ? `in ${c.unit}` : null,
                                    c.mixed_units ? "mixed units" : null,
                                    `${c.unique} unique`,
                                    `${c.missing} missing`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ");
                                return (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => toggleDrop(c.name)}
                                        aria-pressed={!off}
                                        title={hint}
                                        className={`${chipBase} ${off ? chipOff : chipOn}`}
                                    >
                                        {c.name}
                                        {c.kind === "numeric" && c.raw_kind === "categorical" && (
                                            <span className="ml-1.5 text-[10px] text-muted">was text</span>
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                </Panel>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Panel title="Reading the file" subtitle="We try to read what the values really are.">
                        <div className="space-y-4">
                            <div>
                                <Label
                                    title="Numbers written as text"
                                    hint='Turns "2.5 s" and "$4,500" into real numbers instead of thousands of categories.'
                                />
                                <Segmented
                                    value={config.parseNumbers ? "on" : "off"}
                                    onChange={(v) => update({ parseNumbers: v === "on" })}
                                    options={[
                                        { value: "on", label: "Read them" },
                                        { value: "off", label: "Leave as text" },
                                    ]}
                                />
                            </div>

                            <div>
                                <Label
                                    title="Columns with hundreds of one-off values"
                                    hint={cardinalityHelp[config.highCardinality]}
                                />
                                <Segmented
                                    value={config.highCardinality}
                                    onChange={(v) => update({ highCardinality: v })}
                                    options={[
                                        { value: "group_rare", label: "Group them" },
                                        { value: "drop", label: "Drop" },
                                        { value: "keep", label: "Keep all" },
                                    ]}
                                />
                            </div>

                            <div>
                                <Label
                                    title="Columns that give the answer away"
                                    hint="A feature that is the target under another name teaches the model nothing honest."
                                />
                                <Segmented
                                    value={config.dropLeaky ? "on" : "off"}
                                    onChange={(v) => update({ dropLeaky: v === "on" })}
                                    options={[
                                        { value: "on", label: "Drop them" },
                                        { value: "off", label: "Keep them" },
                                    ]}
                                />
                            </div>
                        </div>
                    </Panel>

                    <Panel title="Missing values and scaling" subtitle="How gaps are filled and numbers are shaped.">
                        <div className="space-y-4">
                            <div>
                                <Label title="Numbers" hint="Fill gaps with a typical value, learned from training rows." />
                                <Segmented
                                    value={config.numericImpute}
                                    onChange={(v) => update({ numericImpute: v })}
                                    options={[
                                        { value: "median", label: "Median" },
                                        { value: "mean", label: "Mean" },
                                    ]}
                                />
                            </div>
                            <div>
                                <Label title="Text" hint="Fill gaps with a typical value, learned from training rows." />
                                <Segmented
                                    value={config.categoricalImpute}
                                    onChange={(v) => update({ categoricalImpute: v })}
                                    options={[
                                        { value: "most_frequent", label: "Most common" },
                                        { value: "missing_label", label: "'missing' label" },
                                    ]}
                                />
                            </div>
                            <div>
                                <Label title="Scaling" hint={scalingHelp[config.scaling]} />
                                <Segmented
                                    value={config.scaling}
                                    onChange={(v) => update({ scaling: v })}
                                    options={[
                                        { value: "standard", label: "Standardize" },
                                        { value: "minmax", label: "Min-Max" },
                                        { value: "none", label: "None" },
                                    ]}
                                />
                            </div>
                        </div>
                    </Panel>
                </div>

                <Panel title="Train / test split" subtitle="Train rows teach the model. Test rows stay hidden until scoring.">
                    <div className="flex h-8 max-w-md overflow-hidden rounded-md text-xs font-semibold">
                        <div
                            className="grid place-items-center whitespace-nowrap bg-accent text-white"
                            style={{ width: `${trainPct}%` }}
                        >
                            Train {trainPct}%
                        </div>
                        <div
                            className="grid place-items-center whitespace-nowrap bg-line text-muted"
                            style={{ width: `${testPct}%` }}
                        >
                            Test {testPct}%
                        </div>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="0.5"
                        step="0.05"
                        value={config.testSize}
                        onChange={(e) => update({ testSize: parseFloat(e.target.value) })}
                        className="mt-3 w-full max-w-md accent-blue-600"
                        aria-label="Test set size"
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.stratify}
                                onChange={(e) => update({ stratify: e.target.checked })}
                                className="h-4 w-4 accent-blue-600"
                            />
                            Stratify (keep class ratios)
                        </label>
                        <label className="flex items-center gap-2">
                            Seed
                            <input
                                type="number"
                                value={config.randomState}
                                onChange={(e) => update({ randomState: parseInt(e.target.value, 10) || 0 })}
                                className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
                            />
                        </label>
                    </div>

                    <div className="mt-4 border-t border-line pt-4">
                        <Label
                            title="Cross-validation"
                            hint="Trains the same model on different rows and reports the average. One split is a noisy measurement."
                        />
                        <Segmented
                            value={String(config.cvFolds)}
                            onChange={(v) => update({ cvFolds: parseInt(v, 10) })}
                            options={[
                                { value: "0", label: "Off" },
                                { value: "3", label: "3 folds" },
                                { value: "5", label: "5 folds" },
                                { value: "10", label: "10 folds" },
                            ]}
                        />
                    </div>
                </Panel>

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        type="button"
                        onClick={run}
                        disabled={loading || !config.target}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                    >
                        {loading && (
                            <span
                                aria-hidden="true"
                                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                            />
                        )}
                        {loading ? "Preparing…" : result ? "Prepare again" : "Prepare data"}
                    </button>

                    {stale && !loading && (
                        <span className="text-sm text-warn">Settings changed — press the button to apply them.</span>
                    )}
                </div>

                {error && (
                    <p className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
                        {error}
                    </p>
                )}
            </div>

            {result && <PrepResult result={result} stale={stale} />}
        </div>
    );
}
