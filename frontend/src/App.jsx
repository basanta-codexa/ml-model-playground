import Navbar from "./components/Navbar";
import Intro from "./components/Intro";
import Playground from "./components/Playground";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
    return (
        <div className="min-h-screen">
            <Navbar />
            <main>
                <Intro />
                <ErrorBoundary>
                    <Playground />
                </ErrorBoundary>
            </main>
            <footer className="border-t border-line py-6 text-center text-xs text-muted">
                Runs entirely on this machine. Your data is never uploaded anywhere.
            </footer>
        </div>
    );
}
