import Panel from "./Panel";

/**
 * Shows how much the score moves when you train on different rows.
 *
 * A single test split is one draw from a hat. Cross-validation trains
 * several times over and shows the spread, so the number comes with an
 * honest "plus or minus" attached to it.
 */
export default function FoldChart({ cv, cvBaseline, holdout }) {
    if (!cv || !cv.folds?.length) return null;

    const isAccuracy = cv.metric === "accuracy";
    const values = [...cv.folds];
    if (cvBaseline) values.push(cvBaseline.mean);
    // Scale the bars from the spread that is actually in the folds (plus a
    // little padding), so the variation is visible. Anchoring to zero turns
    // every bar into a near-identical full-width stripe.
    const hi = Math.max(...values);
    const flo = Math.min(...values);
    const pad = (hi - flo) * 0.25 || (hi || 1) * 0.1 || 1;
    const lo = flo - pad;
    const pct = (v) => ((v - lo) / (hi - lo)) * 100;

    const mean = cv.mean;
    const std = cv.std;
    const low = mean - 2 * std;
    const high = mean + 2 * std;

    const format = (v) => (isAccuracy ? `${v.toFixed(1)}%` : v.toFixed(3));

    let note = null;
    if (holdout !== null && holdout !== undefined) {
        const gap = holdout - mean;
        if (Math.abs(gap) <= std) {
            note = `The single test split said ${format(holdout)}, which sits inside the spread. The two agree, so the score is real.`;
        } else if (gap > 0) {
            note = `The single test split said ${format(holdout)}, which is above the spread. That split was a lucky one. Trust the cross-validated number instead.`;
        } else {
            note = `The single test split said ${format(holdout)}, which is below the spread. That split was an unlucky one. The cross-validated number is the fairer estimate.`;
        }
    }

    return (
        <Panel
            title="How stable is that score?"
            subtitle={`The same model, trained ${cv.n_splits} times over on different rows.`}
            className="mt-4"
        >
            <div className="space-y-2.5">
                {cv.folds.map((value, i) => (
                    <div key={i}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-muted">Fold {i + 1}</span>
                            <span className="tnum text-ink/90">{format(value)}</span>
                        </div>
                        <div role="presentation" className="h-2 overflow-hidden rounded-full bg-line">
                            <div
                                className="h-full rounded-full bg-accent"
                                style={{ width: `${pct(value)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {cvBaseline && (
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                    The baseline, cross-validated the same way, scores {format(cvBaseline.mean)}.
                    A model has to beat that, not zero.
                </p>
            )}

            <div className="mt-3 rounded-lg bg-canvas px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Cross-validated score
                </div>
                <div className="tnum mt-1 text-2xl font-bold tracking-tight text-ink">
                    {format(mean)}
                    <span className="ml-2 text-base font-normal text-muted">
                        ± {std.toFixed(1)} points
                    </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    So the honest answer is{" "}
                    <strong className="text-ink">
                        about {format(Math.max(low, 0))} to {format(high)}
                    </strong>
                    , not one exact number. Anything inside that range is the same result,
                    measured slightly differently.
                </p>
            </div>

            {note && <p className="mt-3 text-sm text-muted">{note}</p>}
        </Panel>
    );
}
