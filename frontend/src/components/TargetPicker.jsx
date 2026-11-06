import Panel from "./Panel";

const taskStyle = {
    classification: "bg-accent-soft text-accent",
    regression: "bg-warn-soft text-warn",
};

/**
 * Lets the user pick any column as the target, not just the ones with a
 * friendly number of classes. The backend suggests which columns look like
 * good targets and says why; the choice stays with the user.
 */
export default function TargetPicker({ dataset, task, onTask, value, onChange }) {
    const columns = dataset.columns || [];
    const suggestions = dataset.target_suggestions || [];
    const suggested = new Set(suggestions.map((s) => s.name));

    return (
        <Panel
            title="What do you want to predict?"
            subtitle="Pick any column. We will work out the rest."
        >
            <div className="space-y-4">
                {suggestions.length > 0 && (
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                            Good candidates
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {suggestions.map((s) => {
                                const active = s.name === value;
                                return (
                                    <button
                                        key={s.name}
                                        type="button"
                                        onClick={() => onChange(s.name)}
                                        title={s.detail}
                                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                            active
                                                ? "border-accent bg-accent-soft text-accent"
                                                : "border-line bg-surface text-muted hover:text-ink"
                                        }`}
                                    >
                                        {s.name}
                                        <span
                                            className={`ml-1.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${taskStyle[s.task] || ""}`}
                                        >
                                            {s.task === "regression" ? "number" : "label"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        All {columns.length} columns
                    </div>
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
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
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        What kind of answer?
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {[
                            { value: "classification", label: "A label", hint: "One of a fixed set: yes/no, a species, a tier." },
                            { value: "regression", label: "A number", hint: "A quantity: a price, a temperature, a count." },
                            { value: "auto", label: "Decide for me", hint: "We look at the column and pick the sensible one." },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onTask(option.value)}
                                title={option.hint}
                                aria-pressed={task === option.value}
                                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                                    task === option.value
                                        ? "border-accent bg-accent-soft font-medium text-accent"
                                        : "border-line bg-surface text-muted hover:text-ink"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                        {task === "auto"
                            ? "We will look at the target column and choose."
                            : task === "regression"
                                ? "A number to predict. Scored with R-squared and error in the same unit."
                                : "A label to predict. Scored with accuracy, precision, recall and F1."}
                    </p>
                </div>
            </div>
        </Panel>
    );
}
