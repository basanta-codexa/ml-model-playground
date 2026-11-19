import { useEffect, useRef, useState } from "react";
import { getModels, trainModel } from "../api";
import ModelPicker from "./ModelPicker";
import TrainResult from "./TrainResult";
import Scoreboard from "./Scoreboard";

export default function Training({ dataset, prepared }) {
    const task = prepared?.task || "classification";
    const [models, setModels] = useState([]);
    const [selected, setSelected] = useState("");
    const [results, setResults] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [tune, setTune] = useState(false);
    const [notSaved, setNotSaved] = useState(false);

    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    useEffect(() => {
        setError("");
        getModels(task)
            .then((list) => {
                setModels(list);
                setSelected((current) =>
                    list.some((m) => m.id === current) ? current : list[0]?.id ?? ""
                );
            })
            .catch((e) => setError(e.message));
    }, [task]);

    useEffect(() => {
        setResults({});
    }, [prepared]);

    const current = models.find((m) => m.id === selected);

    async function train() {
        setBusy(true);
        setError("");
        try {
            const res = await trainModel(dataset.dataset_id, selected, tune);
            if (!alive.current) return;
            setNotSaved(res.persisted === false);
            setResults((r) => ({ ...r, [res.model_id]: res }));
        } catch (e) {
            if (alive.current) setError(e.message);
        } finally {
            if (alive.current) setBusy(false);
        }
    }

    return (
        <section className="mt-10">
            <h2 className="border-b border-line pb-3 text-lg font-semibold text-ink">
                Train a model
            </h2>

            {!prepared ? (
                <p className="mt-4 text-sm text-muted">Prepare the data above to unlock training.</p>
            ) : (
                <>
                    <div className="mt-4">
                        <ModelPicker
                            models={models}
                            selected={selected}
                            onSelect={setSelected}
                            trainedIds={Object.keys(results)}
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                        <button
                            type="button"
                            onClick={train}
                            disabled={busy || !current}
                            className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                            {busy ? "Training…" : `Train ${current?.label ?? "model"}`}
                        </button>

                        {current?.tunable && (
                            <label className="flex items-center gap-2 text-sm text-muted">
                                <input
                                    type="checkbox"
                                    checked={tune}
                                    onChange={(e) => setTune(e.target.checked)}
                                />
                                Quick tune (small randomized search)
                            </label>
                        )}
                    </div>

                    {busy && <p className="mt-3 text-sm text-muted">Training…</p>}
                    {error && <p className="mt-3 text-sm text-bad">{error}</p>}
                    {notSaved && (
                        <p className="mt-3 text-sm text-warn">
                            The database is unavailable, so this run was not saved.
                        </p>
                    )}

                    {!busy && results[selected] && (
                        <TrainResult key={selected} result={results[selected]} />
                    )}

                    {Object.keys(results).length > 0 && (
                        <Scoreboard results={Object.values(results)} />
                    )}
                </>
            )}
        </section>
    );
}
