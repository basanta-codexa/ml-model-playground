import { useEffect, useState } from "react";
import Panel from "./Panel";
import { fmtNum } from "../utils";

function NumericView({ col }) {
    if (!col.histogram) return <p className="text-sm text-muted">No numeric values to chart.</p>;

    const stats = col.stats || {};
    const tiles = [
        ["Mean", stats.mean],
        ["Std dev", stats.std],
        ["Min", stats.min],
        ["25%", stats.q25],
        ["Median", stats.median],
        ["75%", stats.q75],
        ["Max", stats.max],
    ];

    return (
        <>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-xs text-muted">
                        <th className="py-1.5 font-medium">Range</th>
                        <th className="py-1.5 font-medium">Rows</th>
                    </tr>
                </thead>
                <tbody>
                    {col.histogram.map((b, i) => (
                        <tr key={i} className="border-b border-line/60 last:border-0">
                            <td className="tnum py-1.5">
                                {fmtNum(b.start)} – {fmtNum(b.end)}
                            </td>
                            <td className="tnum py-1.5">{b.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tiles.map(([label, value]) => (
                    <div key={label} className="rounded-md bg-canvas px-3 py-2">
                        <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
                        <dd className="tnum mt-0.5 text-sm text-ink">{fmtNum(value)}</dd>
                    </div>
                ))}
            </dl>
        </>
    );
}

function CategoricalView({ col }) {
    const hidden = col.unique - col.top_values.length;

    return (
        <div>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-xs text-muted">
                        <th className="py-1.5 font-medium">Value</th>
                        <th className="py-1.5 font-medium">Rows</th>
                    </tr>
                </thead>
                <tbody>
                    {col.top_values.map((v) => (
                        <tr key={v.value} className="border-b border-line/60 last:border-0">
                            <td className="py-1.5">{v.value}</td>
                            <td className="tnum py-1.5">{v.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {hidden > 0 && (
                <p className="mt-2 text-xs text-muted">+ {hidden} more distinct values not shown</p>
            )}
        </div>
    );
}

export default function ColumnExplorer({ columns }) {
    const [name, setName] = useState(columns[0]?.name);
    const col = columns.find((c) => c.name === name) ?? columns[0];

    useEffect(() => {
        if (!columns.some((c) => c.name === name)) setName(columns[0]?.name);
    }, [columns, name]);

    if (!col) return null;

    return (
        <Panel
            title="Column explorer"
            subtitle={col.kind === "numeric" ? "Distribution of the values." : "Most common values."}
        >
            <select
                value={col.name}
                onChange={(e) => setName(e.target.value)}
                className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink sm:w-80"
            >
                {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                        {c.name} ({c.kind}){c.unit ? ` · ${c.unit}` : ""}
                    </option>
                ))}
            </select>

            {col.kind === "numeric" ? <NumericView col={col} /> : <CategoricalView col={col} />}
        </Panel>
    );
}
