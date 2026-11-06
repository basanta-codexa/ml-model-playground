import Panel from "./Panel";

const kindStyle = {
    numeric: "border-accent/30 bg-accent-soft text-accent",
    categorical: "border-line bg-canvas text-muted",
    empty: "border-line bg-canvas text-muted",
};

/**
 * Shows what the parser decided about every column, so nothing happens
 * behind the user's back.
 */
export default function ColumnDecisions({ columns, leaked = [] }) {
    if (!columns || columns.length === 0) return null;

    const leakedSet = new Set(leaked);

    return (
        <Panel
            title="What we found in each column"
            subtitle="Every column, and what we did with it."
            className="mt-6"
        >
            <div className="space-y-2">
                {columns.map((col) => {
                    const leakedCol = leakedSet.has(col.name);
                    const notes = col.notes || [];
                    const variants = col.variants || [];

                    return (
                        <div
                            key={col.name}
                            className={`rounded-lg border px-4 py-3 ${
                                leakedCol
                                    ? "border-bad/30 bg-bad-soft"
                                    : "border-line bg-surface"
                            }`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-ink">{col.name}</span>
                                <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindStyle[col.kind] || ""}`}
                                >
                                    {col.kind === "numeric" ? "read as numbers" : "read as labels"}
                                </span>
                                {col.unit && (
                                    <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                                        unit: {col.unit}
                                        {col.base_unit && col.base_unit !== col.unit
                                            ? ` → ${col.base_unit}`
                                            : ""}
                                    </span>
                                )}
                                {col.mixed && (
                                    <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
                                        mixed units → split
                                    </span>
                                )}
                                {leakedCol && (
                                    <span className="rounded bg-bad-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bad">
                                        leaks the target → dropped
                                    </span>
                                )}
                            </div>

                            {col.kind === "numeric" && col.parse_ratio < 1 && (
                                <p className="mt-1.5 text-xs text-muted">
                                    {Math.round(col.parse_ratio * 100)}% of the values were read as
                                    numbers, with the units and symbols taken off.
                                </p>
                            )}

                            {variants.length > 0 && (
                                <p className="mt-1.5 text-xs text-muted">
                                    Folded together:{" "}
                                    {variants
                                        .slice(0, 3)
                                        .map((group) =>
                                            group.variants.map((v) => v.value).join(" / ")
                                        )
                                        .join(" · ")}
                                </p>
                            )}

                            {notes.map((note) => (
                                <p key={note.title} className="mt-1.5 text-xs leading-relaxed text-muted">
                                    <span className="font-semibold text-warn">{note.title}:</span>{" "}
                                    {note.text}
                                </p>
                            ))}
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}
