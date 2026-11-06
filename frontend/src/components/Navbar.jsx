import ApiBadge from "./ApiBadge";

export default function Navbar() {
    return (
        <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
                <a href="#" className="flex items-center gap-2.5 font-semibold tracking-tight text-ink">
                    <span
                        aria-hidden="true"
                        className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white"
                    >
                        <svg width="14" height="14" viewBox="0 0 100 100" fill="none">
                            <path d="M18 70 L38 42 L50 58 L66 30" stroke="white" strokeWidth="9"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    ML Playground
                </a>
                <ApiBadge />
            </div>
        </header>
    );
}
