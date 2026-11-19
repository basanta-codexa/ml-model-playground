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
        ["Rows", rows],
        ["Columns", columns.length],
        ["Numeric columns", numeric],
        ["Missing cells", missing],
    ];

    return (
        <div className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
                <h2 className="text-lg font-semibold text-ink">{name}</h2>
                <p className="text-sm text-muted">
                    Suggested target: <span className="text-ink">{suggested_target}</span>
                </p>
            </div>
            {encoding_note && <p className="mt-2 text-xs text-warn">{encoding_note}</p>}

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
                {stats.map(([label, value]) => (
                    <div key={label} className="bg-surface px-3 py-2">
                        <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
                        <dd className="tnum mt-1 text-lg text-ink">{value}</dd>
                    </div>
                ))}
            </dl>

            <p className="mt-4 text-sm text-muted">
                {columns.map((c, i) => (
                    <span key={c.name}>
                        {i > 0 && " · "}
                        {c.name} ({c.kind})
                    </span>
                ))}
            </p>

            <div className="mt-4 overflow-x-auto rounded-md border border-line bg-surface">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-line text-xs text-muted">
                            {columns.map((c) => (
                                <th key={c.name} className="whitespace-nowrap px-3 py-2 font-medium">
                                    {c.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {preview.map((row, i) => (
                            <tr key={i} className="border-b border-line/60 last:border-0">
                                {columns.map((c) => {
                                    const value = row[c.name];
                                    return (
                                        <td
                                            key={c.name}
                                            className="tnum whitespace-nowrap px-3 py-1.5"
                                        >
                                            {value === null || value === undefined
                                                ? "—"
                                                : formatCell(value)}
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
