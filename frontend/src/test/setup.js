import "@testing-library/jest-dom";

// jsdom does not implement these browser observers. The app no longer
// animates on scroll, but keep the shims so components that might use them
// never crash the test suite.
if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

if (!window.IntersectionObserver) {
    class FakeIntersectionObserver {
        constructor(callback) {
            this.callback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
            return [];
        }
    }
    window.IntersectionObserver = FakeIntersectionObserver;
    global.IntersectionObserver = FakeIntersectionObserver;
}
