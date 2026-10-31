// The detailed event log lives beside the Research tab. Links elsewhere (results evidence, "Full event log")
// ask the run viewer to switch there, then run `then` once the log is on screen.
export const OPEN_LOG_EVENT = "run:open-log";
const MAX_FRAMES = 120;

export function openEventLog(then?: () => void): void {
  window.dispatchEvent(new CustomEvent(OPEN_LOG_EVENT));
  if (!then) return;
  let frames = 0;
  const wait = () => {
    if (document.getElementById("feed-title") || ++frames > MAX_FRAMES) then();
    else requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}
