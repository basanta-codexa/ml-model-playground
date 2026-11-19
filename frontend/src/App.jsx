import Navbar from "./components/Navbar";
import Playground from "./components/Playground";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
    return (
        <div className="min-h-screen">
            <Navbar />
            <main>
                <ErrorBoundary>
                    <Playground />
                </ErrorBoundary>
            </main>
        </div>
    );
}
