import { useState } from "react";
import Panel from "./Panel";
import Segmented from "./Segmented";
import { confusionCell } from "../utils";

const BLUE = "#2563eb";
const RED = "#ef4444";

/**
 * The confusion matrix, drawn so a person can read it.
 *
 * The colour says whether a cell is a right answer or a mistake, hovering a
 * cell says what went wrong in words, and the summary underneath says which
 * class the model struggles with most.
 */
export default function ConfusionMatrix({ matrix, classNames }) {
    const [view, setView] = useState("counts");
    const [hovered, setHovered] = useState(null);

    if (!matrix || !matrix.length || !classNames?.length) return null;

    const size = matrix.length;
    const labels = classNames.slice(0, size);

    // The two scales are kept separate on purpose. If the correct answers
    // set the scale, the mistakes all look like zero.
    let maxRight = 0;
    let maxWrong = 0;
    const maxRow = new Array(size).fill(0);
    matrix.forEach((row, i) => {
        const rowTotal = row.reduce((a, b) => a + b, 0);
        maxRow[i] = rowTotal;
        row.forEach((value, j) => {
            if (i === j) {
                maxRight = Math.max(maxRight, value);
            } else {
                maxWrong = Math.max(maxWrong, value);
            }
        });
    });

    let worst = null;
    matrix.forEach((row, i) => {
        row.forEach((value, j) => {
            if (i !== j && value > 0 && (!worst || value > worst.value)) {
                worst = { actual: i, predicted: j, value };
            }
        });
    });

    const perClass = labels.map((label, i) => {
        const right = matrix[i][i];
        const rows = maxRow[i];
        return {
            label,
            right,
            rows,
            pct: rows > 0 ? Math.round((right / rows) * 100) : 0,
        };
    }).sort((a, b) => a.pct - b.pct);

    const cellStyle = (i, j) => confusionCell(matrix[i][j], i === j, maxRight, maxWrong);

    const cellText = (i, j) => {
        const value = matrix[i][j];
        if (view === "row") {
            return maxRow[i] > 0 ? `${Math.round((value / maxRow[i]) * 100)}%` : "-";
        }
        return value;
    };

    const explanation = hovered
        ? hovered.i === hovered.j
            ? `${hovered.value} rows really were "${labels[hovered.i]}", and the model got all ${hovered.value} of them right.`
            : `${hovered.value} rows really were "${labels[hovered.i]}", but the model called them "${labels[hovered.j]}".`
        : worst
            ? `The most common mistake: ${worst.value} rows of "${labels[worst.actual]}" were called "${labels[worst.predicted]}".`
            : "No mistakes at all.";

    return (
        <Panel
            title="Where it goes wrong"
            subtitle="Every row is what the answer really was. Every column is what the model said."
            className="mt-4"
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: BLUE }} />
                        right
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: RED }} />
                        mistake
                    </span>
                </div>
                <Segmented
                    value={view}
                    onChange={setView}
                    options={[
                        { value: "counts", label: "How many rows" },
                        { value: "row", label: "Percent of each class" },
                    ]}
                />
            </div>

            <div className="overflow-x-auto pb-2">
                <div
                    className="min-w-fit"
                    style={{
                        display: "grid",
                        gridTemplateColumns: `minmax(80px, 130px) repeat(${size}, minmax(46px, 1fr))`,
                        gap: "3px",
                    }}
                >
                    <div className="flex items-end justify-end pb-1 pr-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        predicted
                    </div>
                    {labels.map((label, j) => (
                        <div
                            key={`h-${j}`}
                            title={label}
                            className="truncate pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted"
                        >
                            {label.length > 10 ? `${label.slice(0, 9)}…` : label}
                        </div>
                    ))}

                    {matrix.map((row, i) => (
                        <Row
                            key={`r-${i}`}
                            label={labels[i]}
                            row={row}
                            i={i}
                            cellStyle={cellStyle}
                            cellText={cellText}
                            onHover={setHovered}
                        />
                    ))}
                </div>
            </div>

            <p aria-live="polite" className="mt-3 rounded-lg bg-canvas px-4 py-3 text-sm text-muted">
                {explanation}
            </p>

            <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Per class
                </div>
                <ul className="mt-2 space-y-2">
                    {perClass.map((c) => (
                        <li key={c.label}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="truncate text-ink/90">{c.label}</span>
                                <span className="tnum shrink-0 text-muted">
                                    {c.right} of {c.rows} right
                                    <span className={c.pct === 100 ? "ml-2 text-ok" : c.pct < 70 ? "ml-2 text-bad" : "ml-2"}>
                                        {c.pct}%
                                    </span>
                                </span>
                            </div>
                            <div role="presentation" className="h-1.5 overflow-hidden rounded-full bg-line">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${c.pct}%`, background: c.pct < 70 ? RED : BLUE }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </Panel>
    );
}

function Row({ label, row, i, cellStyle, cellText, onHover }) {
    return (
        <>
            <div
                title={label}
                className="flex items-center justify-end truncate pr-2 text-right text-xs text-muted"
            >
                {label.length > 16 ? `${label.slice(0, 15)}…` : label}
            </div>
            {row.map((value, j) => (
                <button
                    key={j}
                    type="button"
                    onMouseEnter={() => onHover({ i, j, value })}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover({ i, j, value })}
                    onBlur={() => onHover(null)}
                    className="tnum grid h-9 place-items-center rounded-md text-xs font-semibold transition-transform hover:scale-105"
                    style={cellStyle(i, j)}
                >
                    {cellText(i, j)}
                </button>
            ))}
        </>
    );
}
