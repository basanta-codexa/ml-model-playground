import Panel from "./Panel";

export default function FoldChart({ cv, cvBaseline, holdout }) {
    if (!cv || !cv.folds?.length) return null;

    const format = (v) =>
        cv.metric === "accuracy" ? `${Number(v).toFixed(1)}%` : Number(v).toFixed(3);

    return (
        <Panel title="Cross-validation folds" subtitle={`${cv.n_splits} splits of the training rows.`}>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-xs text-muted">
                        <th className="py-1.5 font-medium">Split</th>
                        <th className="py-1.5 font-medium">Score</th>
                    </tr>
                </thead>
                <tbody>
                    {cv.folds.map((value, i) => (
                        <tr key={i} className="border-b border-line/60 last:border-0">
                            <td className="py-1.5 text-muted">Fold {i + 1}</td>
                            <td className="tnum py-1.5">{format(value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <p className="mt-3 text-sm text-ink">
                Mean {Number(cv.mean).toFixed(3)} ± {Number(cv.std).toFixed(3)}
                {cv.metric === "accuracy" ? " percentage points" : ""}.
            </p>
            {cvBaseline && (
                <p className="mt-1 text-sm text-muted">
                    Cross-validated baseline: {format(cvBaseline.mean)}.
                </p>
            )}
            {holdout !== null && holdout !== undefined && (
                <p className="mt-1 text-sm text-muted">
                    The single test split said {format(holdout)}.
                </p>
            )}
        </Panel>
    );
}
