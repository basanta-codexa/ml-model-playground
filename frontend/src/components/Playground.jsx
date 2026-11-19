import { useState } from "react";
import Dropzone from "./Dropzone";
import SampleDatasets from "./SampleDatasets";
import DatasetPreview from "./DatasetPreview";
import DataProfile from "./DataProfile";
import Preprocessing from "./Preprocessing";
import Training from "./Training";
import History from "./History";
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
            setPrepared(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="mx-auto max-w-4xl px-6 py-10">
            <Dropzone onFile={(file) => run(() => uploadCsv(file))} loading={loading} />

            {error && <p className="mt-3 text-sm text-bad">{error}</p>}

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

            <History />
        </section>
    );
}
