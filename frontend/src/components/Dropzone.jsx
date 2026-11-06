import { useRef, useState } from "react";
import { Upload } from "lucide-react";

const MAX_MB = 10;

export default function Dropzone({ onFile, loading }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    function handleFile(file) {
        if (!file) return;
        // The server re-checks everything; these are just for fast feedback.
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
            <button
                type="button"
                onClick={() => !loading && inputRef.current.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragging
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-zinc-300"
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                        handleFile(e.target.files[0]);
                        e.target.value = ""; // lets you pick the same file twice in a row
                    }}
                />
                <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Upload size={20} />
                </span>
                {loading ? (
                    <span className="flex items-center gap-2 text-sm text-muted">
                        <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
                        />
                        Reading your data…
                    </span>
                ) : (
                    <span>
                        <span className="block text-base font-semibold text-ink">
                            Drop a CSV here, or click to browse
                        </span>
                        <span className="mt-1 block text-sm text-muted">Up to {MAX_MB} MB</span>
                    </span>
                )}
            </button>

            {error && <p className="mt-2 text-center text-sm text-bad">{error}</p>}
        </div>
    );
}
