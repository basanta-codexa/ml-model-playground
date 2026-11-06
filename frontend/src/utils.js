// Compact, readable numbers for axes and stat tiles
export function fmtNum(n) {
    if (n === null || n === undefined) return "-";
    const a = Math.abs(n);
    if (a === 0) return "0";
    if (a < 0.01) return n.toExponential(1);
    if (a >= 1000) return Math.round(n).toLocaleString();
    if (a >= 100) return n.toFixed(0);
    if (a >= 10) return n.toFixed(1);
    return n.toFixed(2);
}

/**
 * The colour of one cell of a confusion matrix.
 *
 * Blue on the diagonal for the right answers, warm red off it for the
 * mistakes. The two are scaled separately on purpose: if the correct
 * answers set the scale, every mistake looks like zero, which is exactly
 * the thing you came to look at.
 */
export function confusionCell(value, isRight, maxRight, maxWrong) {
    if (!value) {
        return { background: "#f6f6f5", color: "#a1a1aa" };
    }
    if (isRight) {
        const intensity = maxRight > 0 ? value / maxRight : 0;
        return {
            background: `rgba(37, 99, 235, ${0.12 + 0.72 * intensity})`,
            color: intensity > 0.45 ? "#ffffff" : "#1e3a8a",
        };
    }
    const intensity = maxWrong > 0 ? value / maxWrong : 0;
    return {
        background: `rgba(239, 68, 68, ${0.14 + 0.62 * intensity})`,
        color: intensity > 0.45 ? "#ffffff" : "#7f1d1d",
    };
}
