export default function ModelPicker({ models, selected, onSelect, trainedIds }) {
    return (
        <div role="radiogroup" aria-label="Algorithms" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => {
                const active = m.id === selected;
                return (
                    <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onSelect(m.id)}
                        className={`rounded-md border px-3 py-2 text-left text-sm ${
                            active ? "border-accent bg-accent-soft" : "border-line bg-surface"
                        }`}
                    >
                        <span className="font-medium text-ink">{m.label}</span>
                        {trainedIds.includes(m.id) && (
                            <span className="ml-2 text-xs text-muted">(trained)</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
