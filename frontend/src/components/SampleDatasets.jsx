import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
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
                Or try a sample
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {samples.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(s.id)}
                        className="group flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent disabled:opacity-60"
                    >
                        <FileText aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-muted group-hover:text-accent" />
                        <span>
                            <span className="block text-sm font-semibold text-ink">{s.label}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-muted">{s.description}</span>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
