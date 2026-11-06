const STEPS = [
    { n: "1", text: "Upload a CSV, even a messy one — we read numbers out of text, fold spellings, and catch columns that leak the answer." },
    { n: "2", text: "Pick what to predict. Every cleaning decision is shown, in plain language." },
    { n: "3", text: "Train a model. Scores are cross-validated and compared against a baseline that knows nothing." },
];

export default function Intro() {
    return (
        <section className="border-b border-line">
            <div className="mx-auto max-w-4xl px-6 pb-14 pt-28">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                    Local · no account · your data stays here
                </p>
                <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
                    Machine learning you can actually see through.
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                    Upload a real-world CSV — numbers written with units, prices
                    with symbols, spellings three ways — and watch it get read
                    properly. Every score is honest: cross-validated and compared
                    against a baseline that knows nothing.
                </p>
                <a
                    href="#playground"
                    className="mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    Start with your CSV
                    <span aria-hidden="true">↓</span>
                </a>

                <ol className="mt-12 divide-y divide-line border-y border-line">
                    {STEPS.map((s) => (
                        <li key={s.n} className="flex items-baseline gap-5 py-3.5">
                            <span className="tnum text-xs font-bold text-accent">{s.n.padStart(2, "0")}</span>
                            <span className="text-sm leading-relaxed text-muted">{s.text}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
