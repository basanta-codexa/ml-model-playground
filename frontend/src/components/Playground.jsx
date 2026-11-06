import { useState } from "react";
import Dropzone from "./Dropzone";
import SampleDatasets from "./SampleDatasets";
import DatasetPreview from "./DatasetPreview";
import DataProfile from "./DataProfile";
import Preprocessing from "./Preprocessing";
import Training from "./Training";
import { uploadCsv, loadSample } from "../api";

export default function Playground() {
    const [dataset, setDataset] = useState(null);
    const [prepared, setPrepared] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function run(action) {
        setLoading(true);
        setError("");
        try {
            setDataset(await action());
            setPrepared(null); // a new dataset needs fresh preprocessing
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section id="playground" className="mx-auto max-w-4xl scroll-mt-20 px-6 py-14">
            <div className="mb-6 border-b border-line pb-6">
                <h2 className="text-2xl font-bold tracking-tight text-ink">Try it</h2>
                <p className="mt-1 text-sm text-muted">
                    Upload a CSV, or start from one of the samples — every sample is a real file with real mess.
                </p>
            </div>

            <Dropzone onFile={(file) => run(() => uploadCsv(file))} loading={loading} />

            {error && (
                <p className="mt-3 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
                    {error}
                </p>
            )}

            <SampleDatasets onPick={(id) => run(() => loadSample(id))} disabled={loading} />

            {dataset && <DatasetPreview key={dataset.dataset_id} dataset={dataset} />}
            {dataset && <DataProfile key={`profile-${dataset.dataset_id}`} dataset={dataset} />}
            {dataset && (
                <Preprocessing
                    key={`prep-${dataset.dataset_id}`}
                    dataset={dataset}
                    onPrepared={setPrepared}
                />
            )}
            {dataset && (
                <Training
                    key={`train-${dataset.dataset_id}`}
                    dataset={dataset}
                    prepared={prepared}
                />
            )}
        </section>
    );
}
