import { useEffect, useRef, useState } from "react";
import { getModels, trainModel } from "../api";
import ModelPicker from "./ModelPicker";
import TrainingScreen from "./TrainingScreen";
import TrainResult from "./TrainResult";
import Scoreboard from "./Scoreboard";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Training({ dataset, prepared }) {
    const task = prepared?.task || "classification";
    const [models, setModels] = useState([]);
    const [selected, setSelected] = useState("");
    const [results, setResults] = useState({}); // model_id -> result
    const [phase, setPhase] = useState("idle"); // "idle" | "training"
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [tune, setTune] = useState(false);

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

    // Preparing the data again means every trained model is out of date
    useEffect(() => {
        setResults({});
    }, [prepared]);

    async function train() {
        setPhase("training");
        setReady(false);
        setError("");
        try {
            // Wait for BOTH the real answer and a minimum animation time
            const [res] = await Promise.all([trainModel(dataset.dataset_id, selected, tune), sleep(1400)]);
            if (!alive.current) return;
            setReady(true);
            await sleep(400);
            if (!alive.current) return;
            setResults((r) => ({ ...r, [res.model_id]: res }));
        } catch (e) {
            if (alive.current) setError(e.message);
        } finally {
            if (alive.current) {
                setPhase("idle");
                setReady(false);
            }
        }
    }

    const heading = (
        <div className="mt-12 border-b border-line pb-3">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Train a model</h2>
            <p className="mt-1 text-sm text-muted">
                {task === "regression"
                    ? "Each algorithm predicts a number in its own way. Pick one, train it, and see how close its guesses are."
                    : "Each algorithm learns differently. Pick one, train it, and see how it does on rows it has never seen."}
            </p>
        </div>
    );

    if (!prepared) {
        return (
            <section className="mt-4">
                {heading}
                <div className="mt-4 rounded-xl border border-dashed border-line bg-surface px-6 py-8 text-center text-sm text-muted">
                    Prepare your data above to unlock training.
                </div>
            </section>
        );
    }

    const current = models.find((m) => m.id === selected);
    const trainedIds = Object.keys(results);

    return (
        <section className="mt-4">
            {heading}

            <div className="mt-4">
                <ModelPicker models={models} selected={selected} onSelect={setSelected} trainedIds={trainedIds} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                    type="button"
                    onClick={train}
                    disabled={phase === "training" || !current}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                    {phase === "training" ? "Training…" : tune && current?.tunable ? `Tune & train ${current?.label}` : `Train ${current?.label ?? "model"}`}
                </button>

                {current?.tunable && (
                    <label
                        className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted"
                        title="Try a handful of settings with a small randomized search, refit the best, and tell you which one won. A little slower, usually a little better."
                    >
                        <input
                            type="checkbox"
                            checked={tune}
                            onChange={(e) => setTune(e.target.checked)}
                            className="h-4 w-4 accent-blue-600"
                        />
                        Quick tune
                    </label>
                )}
            </div>

            {error && (
                <p className="mt-3 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
                    {error}
                </p>
            )}

            {phase === "training" && <TrainingScreen modelLabel={current?.label} ready={ready} />}
            {phase === "idle" && results[selected] && <TrainResult key={selected} result={results[selected]} />}

            {trainedIds.length > 0 && <Scoreboard results={Object.values(results)} />}
        </section>
    );
}
