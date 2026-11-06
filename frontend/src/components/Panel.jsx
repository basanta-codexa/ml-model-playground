export default function Panel({ title, subtitle, children, className = "" }) {
    return (
        <section
            className={`rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
        >
            <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
            {subtitle && <p className="mt-1 text-sm leading-snug text-muted">{subtitle}</p>}
            <div className="mt-4">{children}</div>
        </section>
    );
}
