import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver — stub it for cmdk and other components
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom does not implement scrollIntoView — stub it for cmdk
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}
