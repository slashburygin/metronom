export function normalizeGap(value) {
  const count = (number, fallback, min) => Number.isInteger(number) && number >= min && number <= 16 ? number : fallback;
  return { enabled: value?.enabled === true, playBars: count(value?.playBars, 2, 1), silentBars: count(value?.silentBars, 2, 1), hideVisual: value?.hideVisual !== false };
}
export function gapPhase(index, beatsPerBar, settings) {
  const bar = Math.floor(index / beatsPerBar);
  return settings.enabled && bar % (settings.playBars + settings.silentBars) >= settings.playBars;
}
