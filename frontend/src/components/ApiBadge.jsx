import { useEffect, useState } from "react";

const STYLES = {
    loading: { dot: "bg-amber-400", label: "Connecting…" },
    online: { dot: "bg-emerald-500", label: "API online" },
    offline: { dot: "bg-red-500", label: "API offline" },
};

export default function ApiBadge() {
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/health")
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
            .then(() => !cancelled && setStatus("online"))
            .catch(() => !cancelled && setStatus("offline"));
        return () => {
            cancelled = true;
        };
    }, []);

    const s = STYLES[status];

    return (
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
        </div>
    );
}
