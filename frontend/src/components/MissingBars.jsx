import Panel from "./Panel";

export default function MissingBars({ columns }) {
    const gaps = columns
        .filter((c) => c.missing > 0)
        .sort((a, b) => b.missing_pct - a.missing_pct)
        .slice(0, 10);

    return (
        <Panel title="Missing values" subtitle="Empty cells per column." className="h-full">
            {gaps.length === 0 ? (
                <p className="text-sm text-muted">No missing values.</p>
            ) : (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-line text-xs text-muted">
                            <th className="py-1.5 font-medium">Column</th>
                            <th className="py-1.5 font-medium">Cells</th>
                            <th className="py-1.5 font-medium">Percent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gaps.map((c) => (
                            <tr key={c.name} className="border-b border-line/60 last:border-0">
                                <td className="py-1.5">{c.name}</td>
                                <td className="tnum py-1.5">{c.missing}</td>
                                <td className="tnum py-1.5">{c.missing_pct}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Panel>
    );
}
