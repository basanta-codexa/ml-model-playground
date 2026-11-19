import { Component } from "react";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("Something in the playground broke:", error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="mx-auto max-w-2xl px-6 py-10">
                <div className="rounded-md border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Something broke</h2>
                    <p className="mt-2 text-sm text-muted">
                        This part of the playground hit an error. The rest of the page is fine.
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded bg-canvas p-3 text-left text-xs text-bad">
                        {String(this.state.error?.message || this.state.error)}
                    </pre>
                    <button
                        type="button"
                        onClick={() => this.setState({ error: null })}
                        className="mt-4 rounded-md border border-line bg-surface px-4 py-2 text-sm"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }
}
