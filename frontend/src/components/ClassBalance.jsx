import { useState } from "react";
import Panel from "./Panel";

export default function ClassBalance({ columns, defaultTarget }) {
    const candidates = columns.filter((c) => c.balance);
    const initial =
        candidates.find((c) => c.name === defaultTarget)?.name ?? candidates[0]?.name ?? "";
    const [target, setTarget] = useState(initial);

    const col = candidates.find((c) => c.name === target);

    return (
        <Panel title="Class balance" subtitle="A dominant class makes accuracy misleading." className="h-full">
            {!col ? (
                <p className="text-sm text-muted">
                    No column looks like a class label (2 to 20 distinct values).
                </p>
            ) : (
                <>
                    <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                    >
                        {candidates.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-line text-xs text-muted">
                                <th className="py-1.5 font-medium">Class</th>
                                <th className="py-1.5 font-medium">Rows</th>
                                <th className="py-1.5 font-medium">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {col.balance.counts.map((row) => (
                                <tr key={row.label} className="border-b border-line/60 last:border-0">
                                    <td className="py-1.5">{row.label}</td>
                                    <td className="tnum py-1.5">{row.count}</td>
                                    <td className="tnum py-1.5">{row.pct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <p className="mt-3 text-xs text-muted">
                        Majority class: {col.balance.majority_pct}%. Imbalance ratio:{" "}
                        {col.balance.imbalance_ratio}.
                    </p>
                </>
            )}
        </Panel>
    );
}
