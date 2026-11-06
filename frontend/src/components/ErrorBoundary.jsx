import { Component } from "react";

/**
 * Catches a crash in the tree below it and shows a message instead of a
 * blank screen. Without this, one bad value in one panel takes the whole
 * page down.
 */
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
            <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                <div className="rounded-xl border border-line bg-surface p-8">
                    <h2 className="text-lg font-bold text-ink">Something broke</h2>
                    <p className="mt-2 text-sm text-muted">
                        This part of the playground hit an error. The rest of the page is
                        still fine.
                    </p>
                    <pre className="tnum mt-4 overflow-x-auto rounded-lg bg-canvas px-4 py-3 text-left text-xs text-bad">
                        {String(this.state.error?.message || this.state.error)}
                    </pre>
                    <button
                        type="button"
                        onClick={() => this.setState({ error: null })}
                        className="mt-5 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }
}
