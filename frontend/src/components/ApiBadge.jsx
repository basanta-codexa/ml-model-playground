import { useEffect, useState } from "react";

export default function ApiBadge() {
    const [status, setStatus] = useState("connecting");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/health")
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
            .then((body) => {
                if (!cancelled) setStatus(body?.db === "down" ? "online, history off" : "online");
            })
            .catch(() => !cancelled && setStatus("offline"));
        return () => {
            cancelled = true;
        };
    }, []);

    return <span className="text-xs text-muted">API: {status}</span>;
}
