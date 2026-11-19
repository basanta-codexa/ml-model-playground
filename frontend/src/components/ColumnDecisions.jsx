import Panel from "./Panel";

export default function ColumnDecisions({ columns, leaked = [] }) {
    if (!columns || columns.length === 0) return null;

    const leakedSet = new Set(leaked);

    return (
        <Panel title="Column decisions" subtitle="What was decided for each column." className="mt-6">
            <ul className="space-y-3 text-sm">
                {columns.map((col) => {
                    const details = [
                        col.kind === "numeric" ? "numeric" : "categorical",
                        col.unit ? `unit ${col.unit}${col.base_unit && col.base_unit !== col.unit ? ` → ${col.base_unit}` : ""}` : null,
                        col.mixed ? "mixed units, split" : null,
                        leakedSet.has(col.name) ? "leaks the target, dropped" : null,
                    ].filter(Boolean);

                    return (
                        <li key={col.name}>
                            <span className="font-medium text-ink">{col.name}</span>
                            <span className="text-muted"> — {details.join("; ")}</span>

                            {col.kind === "numeric" && col.parse_ratio < 1 && (
                                <p className="text-xs text-muted">
                                    {Math.round(col.parse_ratio * 100)}% of values read as numbers.
                                </p>
                            )}

                            {col.variants?.length > 0 && (
                                <p className="text-xs text-muted">
                                    Folded together:{" "}
                                    {col.variants
                                        .slice(0, 3)
                                        .map((group) => group.variants.map((v) => v.value).join(" / "))
                                        .join(" · ")}
                                </p>
                            )}

                            {col.notes?.map((note) => (
                                <p key={note.title} className="text-xs text-muted">
                                    {note.title}: {note.text}
                                </p>
                            ))}
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}
