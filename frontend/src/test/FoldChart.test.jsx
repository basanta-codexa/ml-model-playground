import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FoldChart from "../components/FoldChart";

const cv = {
    metric: "accuracy",
    folds: [95.8, 100, 95.8, 91.7, 91.7],
    mean: 95,
    std: 3.1,
    n_splits: 5,
};

const cvBaseline = {
    metric: "accuracy",
    folds: [33.3, 33.3, 33.3, 33.3, 33.3],
    mean: 33.3,
    std: 0,
    n_splits: 5,
};

describe("FoldChart", () => {
    it("labels every row as its fold, not the holdout split", () => {
        render(<FoldChart cv={cv} cvBaseline={cvBaseline} holdout={90} />);
        expect(screen.getByText("Fold 1")).toBeTruthy();
        expect(screen.getByText("Fold 3")).toBeTruthy();
        expect(screen.getByText("Fold 5")).toBeTruthy();
        expect(screen.queryByText("The single test split")).toBeNull();
    });

    it("says how the held-out split compared with the folds", () => {
        render(<FoldChart cv={cv} cvBaseline={cvBaseline} holdout={90} />);
        expect(screen.getByText(/single test split said 90/i)).toBeTruthy();
    });
});
