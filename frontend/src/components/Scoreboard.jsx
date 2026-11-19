import Panel from "./Panel";

export default function Scoreboard({ results }) {
    if (!results || results.length === 0) return null;

    const isRegression = results[0].task === "regression";
    const scoreOf = (r) =>
        r.cv ? r.cv.mean : isRegression ? r.test_r2 : r.test_accuracy;
    const sorted = [...results].sort((a, b) => scoreOf(b) - scoreOf(a));
    const format = (v) =>
        typeof v === "number" && Number.isFinite(v)
            ? isRegression ? v.toFixed(3) : `${v.toFixed(1)}%`
            : "—";

    return (
        <Panel
            title="Scoreboard"
            subtitle={
                isRegression
                    ? "Cross-validated R-squared for each trained model."
                    : "Cross-validated accuracy for each trained model."
            }
            className="mt-6"
        >
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-xs text-muted">
                        <th className="py-1.5 font-medium">Model</th>
                        <th className="py-1.5 font-medium">Score</th>
                        <th className="py-1.5 font-medium">Spread</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((r) => (
                        <tr key={r.model_id} className="border-b border-line/60 last:border-0">
                            <td className="py-1.5">{r.label}</td>
                            <td className="tnum py-1.5">{format(scoreOf(r))}</td>
                            <td className="tnum py-1.5 text-muted">
                                {r.cv ? `± ${Number(r.cv.std).toFixed(3)}` : "—"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Panel>
    );
}
