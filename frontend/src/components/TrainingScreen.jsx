import { useEffect, useState } from "react";

const STAGES = [
    { title: "Loading training rows", note: "The model gets its study material." },
    { title: "Learning patterns", note: "It looks for what separates the answers." },
    { title: "Testing on held-out rows", note: "Rows it has never seen before." },
    { title: "Scoring the answers", note: "Comparing predictions with the truth." },
];

export default function TrainingScreen({ modelLabel, ready }) {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const timers = [setTimeout(() => setTick(1), 500), setTimeout(() => setTick(2), 1100)];
        return () => timers.forEach(clearTimeout);
    }, []);

    const stage = ready ? 3 : tick;

    return (
        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-semibold text-ink">Training {modelLabel}</h3>
                <span className="text-xs text-muted">usually takes a few seconds</span>
            </div>

            <div
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-valuenow={Math.round(((stage + 1) / STAGES.length) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
                />
            </div>

            <ol className="mt-5 space-y-2.5">
                {STAGES.map((s, i) => {
                    const done = i < stage || (ready && i === 3);
                    const current = i === stage && !done;
                    return (
                        <li
                            key={s.title}
                            className={`flex items-center gap-3 ${i > stage ? "opacity-40" : ""}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                                    done ? "bg-accent text-white" : "border border-line text-muted"
                                }`}
                            >
                                {done ? "✓" : current ? "" : ""}
                            </span>
                            <span className="text-sm text-ink/90">{s.title}</span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
