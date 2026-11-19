export default function Panel({ title, subtitle, children, className = "" }) {
    return (
        <section className={`rounded-lg border border-line bg-surface p-4 ${className}`}>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
            <div className="mt-3">{children}</div>
        </section>
    );
}
