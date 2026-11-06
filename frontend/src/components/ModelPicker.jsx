export default function ModelPicker({ models, selected, onSelect, trainedIds }) {
    return (
        <div role="radiogroup" aria-label="Algorithms" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => {
                const active = m.id === selected;
                const trained = trainedIds.includes(m.id);
                return (
                    <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onSelect(m.id)}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                            active
                                ? "border-accent bg-accent-soft"
                                : "border-line bg-surface hover:border-zinc-300"
                        }`}
                    >
                        <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-ink">{m.label}</span>
                            {trained &&
                                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                    trained
                                </span>}
                        </span>
                        <span className="mt-1 block text-xs font-medium text-accent">{m.tagline}</span>
                        <span className="mt-1.5 block text-xs leading-snug text-muted">
                            {m.how_it_thinks}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
