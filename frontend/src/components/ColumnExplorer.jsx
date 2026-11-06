import { useEffect, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import Panel from "./Panel";
import { fmtNum } from "../utils";

function HistTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
            <div className="text-muted">{p.range}</div>
            <div className="font-semibold text-ink">{p.count} rows</div>
        </div>
    );
}

function NumericView({ col }) {
    if (!col.histogram) {
        return <p className="text-sm text-muted">No numeric values to chart.</p>;
    }

    const data = col.histogram.map((b) => ({
        label: fmtNum(b.start),
        range: `${fmtNum(b.start)} to ${fmtNum(b.end)}`,
        count: b.count,
    }));
    const s = col.stats;
    const tiles = [
        ["Mean", s.mean],
        ["Std dev", s.std],
        ["Min", s.min],
        ["25%", s.q25],
        ["Median", s.median],
        ["75%", s.q75],
        ["Max", s.max],
    ];

    return (
        <>
            <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
                        <CartesianGrid stroke="#ececea" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: "#5b5b63", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={16}
                        />
                        <YAxis
                            width={36}
                            tick={{ fill: "#5b5b63", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip cursor={{ fill: "#eef3ff" }} content={<HistTooltip />} />
                        <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tiles.map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-canvas px-3 py-2">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</div>
                        <div className="tnum mt-0.5 text-base font-semibold text-ink">{fmtNum(value)}</div>
                    </div>
                ))}
            </div>
        </>
    );
}

function CategoricalView({ col }) {
    const max = Math.max(...col.top_values.map((v) => v.count), 1);
    const hidden = col.unique - col.top_values.length;

    return (
        <div className="space-y-3">
            {col.top_values.map((v) => (
                <div key={v.value}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-ink/90">{v.value}</span>
                        <span className="tnum shrink-0 text-muted">{v.count}</span>
                    </div>
                    <div role="presentation" className="h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${(v.count / max) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
            {hidden > 0 && <p className="text-xs text-muted">+ {hidden} more distinct values not shown</p>}
        </div>
    );
}

export default function ColumnExplorer({ columns }) {
    const [name, setName] = useState(columns[0]?.name);
    const col = columns.find((c) => c.name === name) ?? columns[0];

    useEffect(() => {
        if (!columns.some((c) => c.name === name)) {
            setName(columns[0]?.name);
        }
    }, [columns, name]);

    if (!col) return null;

    return (
        <Panel
            title="Column explorer"
            subtitle={
                col.kind === "numeric"
                    ? "How spread out the values are."
                    : "Most common values."
            }
        >
            <select
                value={col.name}
                onChange={(e) => setName(e.target.value)}
                className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink sm:w-80"
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
