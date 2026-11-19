import { useState } from "react";

const MAX_MB = 10;

export default function Dropzone({ onFile, loading }) {
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    function handleFile(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".csv")) {
            setError("Please choose a .csv file.");
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setError(`That file is too large (max ${MAX_MB} MB).`);
            return;
        }
        setError("");
        onFile(file);
    }

    function onDrop(e) {
        e.preventDefault();
        setDragging(false);
        if (!loading) handleFile(e.dataTransfer.files[0]);
    }

    return (
        <div>
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`rounded-lg border border-dashed border-line bg-surface px-4 py-5 ${dragging ? "border-accent" : ""}`}
            >
                <label className="block text-sm text-ink">
                    CSV file
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={loading}
                        className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded file:border file:border-line file:bg-canvas file:px-3 file:py-1.5 file:text-sm"
                        onChange={(e) => {
                            handleFile(e.target.files[0]);
                            e.target.value = "";
                        }}
                    />
                </label>
                <p className="mt-2 text-xs text-muted">
                    Up to {MAX_MB} MB. Drag and drop works too.
                </p>
            </div>

            {loading && <p className="mt-2 text-sm text-muted">Reading file…</p>}
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        </div>
    );
}
