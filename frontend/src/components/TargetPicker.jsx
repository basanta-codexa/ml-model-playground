import Panel from "./Panel";

export default function TargetPicker({ dataset, task, onTask, value, onChange }) {
    const columns = dataset.columns || [];
    const suggestions = dataset.target_suggestions || [];
    const suggested = new Set(suggestions.map((s) => s.name));

    return (
        <Panel title="Target" subtitle="Pick the column to predict.">
            <div className="space-y-4">
                {suggestions.length > 0 && (
                    <div>
                        <p className="text-xs text-muted">Suggested columns</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {suggestions.map((s) => (
                                <button
                                    key={s.name}
                                    type="button"
                                    onClick={() => onChange(s.name)}
                                    className={`rounded-md border px-2.5 py-1 text-sm ${
                                        s.name === value
                                            ? "border-accent bg-accent-soft"
                                            : "border-line bg-surface"
                                    }`}
                                >
                                    {s.name}{" "}
                                    <span className="text-xs text-muted">
                                        ({s.task === "regression" ? "number" : "label"})
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <p className="text-xs text-muted">All columns</p>
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                    >
                        {columns.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name} — {c.kind === "numeric" ? "numbers" : "labels"}
                                {suggested.has(c.name) ? " (suggested)" : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <p className="text-xs text-muted">Task</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {[
                            ["classification", "A label"],
                            ["regression", "A number"],
                            ["auto", "Decide for me"],
                        ].map(([value_, label]) => (
                            <button
                                key={value_}
                                type="button"
                                onClick={() => onTask(value_)}
                                aria-pressed={task === value_}
                                className={`rounded-md border px-3 py-1.5 text-sm ${
                                    task === value_
                                        ? "border-accent bg-accent-soft"
                                        : "border-line bg-surface"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Panel>
    );
}
