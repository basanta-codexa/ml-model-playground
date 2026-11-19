import { useEffect, useState } from "react";
import { getSamples } from "../api";

export default function SampleDatasets({ onPick, disabled }) {
    const [samples, setSamples] = useState([]);

    useEffect(() => {
        getSamples()
            .then(setSamples)
            .catch(() => setSamples([]));
    }, []);

    if (samples.length === 0) return null;

    return (
        <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Sample datasets
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {samples.map((s) => (
                    <li key={s.id}>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onPick(s.id)}
                            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-left text-sm disabled:opacity-50"
                        >
                            <span className="font-medium text-ink">{s.label}</span>
                            <span className="mt-0.5 block text-xs text-muted">{s.description}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
