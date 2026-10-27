import '@testing-library/jest-dom/vitest';

// jsdom has no layout, so it does not implement scrollIntoView. Chapter jumps call it from a timer that can
// fire after a test ends; a no-op keeps that from surfacing as an unhandled error.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
