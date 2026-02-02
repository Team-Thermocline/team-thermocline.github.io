export function computeStickToBottom(el, thresholdPx = 30) {
  if (!el) return true;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distanceFromBottom < thresholdPx;
}

export function scrollToBottom(el) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

