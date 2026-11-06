import { useState } from "react";
import Panel from "./Panel";

const toneStyle = {
    good: "text-ok",
    mid: "text-warn",
    bad: "text-bad",
};

function verdict(balance) {
    const top = balance.counts[0];
    if (balance.imbalance_ratio < 1.5) {
        return { tone: "good", text: "Well balanced. Accuracy is a fair score here." };
    }
    if (balance.imbalance_ratio < 3) {
        return { tone: "mid", text: "Slightly imbalanced. Watch the per-class scores, not just accuracy." };
    }
    return {
        tone: "bad",
        text: `Imbalanced. A model that always guesses "${top.label}" would already be ${balance.majority_pct}% accurate, so accuracy alone can mislead.`,
    };
}

export default function ClassBalance({ columns, defaultTarget }) {
    const candidates = columns.filter((c) => c.balance);
    const initial =
        candidates.find((c) => c.name === defaultTarget)?.name ?? candidates[0]?.name ?? "";
    const [target, setTarget] = useState(initial);

    const col = candidates.find((c) => c.name === target);
    const v = col ? verdict(col.balance) : null;

    return (
        <Panel
            title="Class balance"
            subtitle="A dominant class makes a lazy model look smart."
            className="h-full"
        >
            {!col ? (
                <p className="text-sm text-muted">
                    No column looks like a class label (we look for columns with 2 to 20 distinct values).
                </p>
            ) : (
                <>
                    <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                    >
                        {candidates.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    <ul className="space-y-3">
                        {col.balance.counts.map((row) => (
                            <li key={`${target}-${row.label}`}>
                                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                    <span className="truncate text-ink/90">{row.label}</span>
                                    <span className="tnum shrink-0 text-muted">
                                        {row.count} <span className="text-xs">({row.pct}%)</span>
                                    </span>
                                </div>
                                <div role="presentation" className="h-1.5 overflow-hidden rounded-full bg-line">
                                    <div
                                        className="h-full rounded-full bg-accent"
                                        style={{ width: `${(row.count / col.balance.counts[0].count) * 100}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>

                    {v && <p className={`mt-4 text-xs leading-relaxed ${toneStyle[v.tone]}`}>{v.text}</p>}
                </>
            )}
        </Panel>
    );
}
