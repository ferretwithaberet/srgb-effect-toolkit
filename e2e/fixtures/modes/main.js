// Reads globals through `window`, so it also runs when nothing defines them ('none').
window.__atUserStart = {
  speed: typeof window.speed,
  engine: typeof window.engine,
  onSpeedChanged: 'onSpeedChanged' in window,
};
window.__speedCalls = 0;
window.onSpeedChanged = () => {
  window.__speedCalls += 1;
};
window.__events = [];
window.onCanvasApiEvent = (event) => window.__events.push(event);
