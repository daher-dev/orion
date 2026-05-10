import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdom doesn't ship ResizeObserver — Radix primitives (Select, etc.) need it.
class _ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = _ResizeObserver as unknown as typeof ResizeObserver;

// Radix uses `hasPointerCapture` / `scrollIntoView` / `releasePointerCapture`
// on pointer interactions; stub them so tests can drive Select etc.
if (typeof window !== "undefined") {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
}

afterEach(() => {
  cleanup();
});
