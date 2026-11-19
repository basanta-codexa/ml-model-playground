import ApiBadge from "./ApiBadge";

export default function Navbar() {
    return (
        <header className="border-b border-line bg-surface">
            <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-6">
                <span className="font-semibold text-ink">ML Playground</span>
                <ApiBadge />
            </div>
        </header>
    );
}
