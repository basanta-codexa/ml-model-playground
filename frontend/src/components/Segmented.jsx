export default function Segmented({ value, onChange, options }) {
    return (
        <div role="group" className="inline-flex flex-wrap gap-1 rounded-md border border-line bg-canvas p-1">
            {options.map((o) => {
                const active = value === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        aria-pressed={active}
                        className={`rounded px-3 py-1.5 text-sm ${active ? "bg-surface font-medium text-ink" : "text-muted"}`}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
