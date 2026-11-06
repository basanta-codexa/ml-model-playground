export default function Segmented({ value, onChange, options }) {
    return (
        <div role="group" className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-canvas p-1">
            {options.map((o) => {
                const active = value === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        aria-pressed={active}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            active
                                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                                : "text-muted hover:text-ink"
                        }`}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
