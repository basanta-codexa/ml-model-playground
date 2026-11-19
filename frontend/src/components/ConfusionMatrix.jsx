import Panel from "./Panel";

export default function ConfusionMatrix({ matrix, classNames }) {
    if (!matrix || !matrix.length || !classNames?.length) return null;

    const labels = classNames.slice(0, matrix.length);

    let worst = null;
    matrix.forEach((row, i) => {
        row.forEach((value, j) => {
            if (i !== j && value > 0 && (!worst || value > worst.value)) {
                worst = { actual: i, predicted: j, value };
            }
        });
    });

    const perClass = labels
        .map((label, i) => {
            const rows = matrix[i].reduce((a, b) => a + b, 0);
            const right = matrix[i][i];
            return {
                label,
                right,
                rows,
                pct: rows ? Math.round((right / rows) * 100) : 0,
            };
        })
        .sort((a, b) => a.pct - b.pct);

    const note = worst
        ? `The most common mistake: ${worst.value} rows of "${labels[worst.actual]}" were called "${labels[worst.predicted]}".`
        : "No mistakes at all.";

    return (
        <Panel
            title="Where it goes wrong"
            subtitle="Rows are the true class. Columns are the prediction."
            className="mt-4"
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-line text-xs text-muted">
                            <th className="py-1.5 font-medium">Actual / predicted</th>
                            {labels.map((label, j) => (
                                <th key={j} className="py-1.5 font-medium">{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, i) => (
                            <tr key={i} className="border-b border-line/60 last:border-0">
                                <th className="py-1.5 text-left font-normal text-muted">
                                    {labels[i]}
                                </th>
                                {row.map((value, j) => (
                                    <td key={j} className="tnum py-1.5">{value}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-sm text-muted">{note}</p>

            <ul className="mt-3 space-y-1 text-sm">
                {perClass.map((c) => (
                    <li key={c.label}>
                        {c.label}: {c.right} of {c.rows} right ({c.pct}%)
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
