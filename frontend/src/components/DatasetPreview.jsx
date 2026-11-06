const kindStyle = {
    numeric: "border-accent/30 bg-accent-soft text-accent",
    categorical: "border-line bg-canvas text-muted",
    empty: "border-line bg-canvas text-muted",
};

function formatCell(value) {
    if (typeof value === "number") {
        return Number.isInteger(value) ? value : Number(value.toFixed(4));
    }
    return String(value);
}

export default function DatasetPreview({ dataset }) {
    const { name, rows, columns, preview, suggested_target, encoding_note } = dataset;

    const numeric = columns.filter((c) => c.kind === "numeric").length;
    const missing = columns.reduce((sum, c) => sum + c.missing, 0);

    const stats = [
        { label: "Rows", value: rows },
        { label: "Columns", value: columns.length },
        { label: "Numeric columns", value: numeric },
        { label: "Missing cells", value: missing },
    ];

    return (
        <div className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
                <h2 className="text-2xl font-bold tracking-tight text-ink">{name}</h2>
                <p className="text-sm text-muted">
                    Suggested target: <span className="font-semibold text-ink">{suggested_target}</span>
                </p>
            </div>
            {encoding_note && (
                <p className="mt-2 text-xs text-warn">{encoding_note}</p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className="bg-surface px-4 py-3">
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{s.label}</dt>
                        <dd className="tnum mt-1 text-2xl font-bold text-ink">{s.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="mt-5 flex flex-wrap gap-1.5">
                {columns.map((c) => (
                    <span
                        key={c.name}
                        title={`${c.dtype} · ${c.unique} unique · ${c.missing} missing`}
                        className={`rounded-md border px-2 py-1 text-xs ${kindStyle[c.kind] || kindStyle.empty}`}
                    >
                        {c.name}
                    </span>
                ))}
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                            {columns.map((c) => (
                                <th key={c.name} className="whitespace-nowrap px-3 py-2 font-medium">
                                    {c.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {preview.map((row, i) => (
                            <tr key={i} className="border-b border-line/60 last:border-0 hover:bg-canvas">
                                {columns.map((c) => {
                                    const value = row[c.name];
                                    return (
                                        <td key={c.name} className="tnum whitespace-nowrap px-3 py-1.5 text-ink/90">
                                            {value === null || value === undefined ? (
                                                <span className="text-xs italic text-bad/80">missing</span>
                                            ) : (
                                                formatCell(value)
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
