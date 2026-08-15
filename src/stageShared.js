/* ============================ Shared constants & helpers ============================ */
export const PLENTY_COLOR = "#22c55e";
export const WARNING_COLOR = "#eab308";
export const DANGER_COLOR = "#ef4444";
export const MODE = { COUNTDOWN: "countdown", COUNTUP: "countup", CLOCK: "clock", HIDDEN: "hidden" };
export const MSG_COLORS = {
  white: { label: "Putih", value: "#f8fafc" },
  green: { label: "Hijau", value: "#22c55e" },
  red: { label: "Merah", value: "#ef4444" },
};
export const LABEL_COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#ec4899",
  "#14b8a6", "#f97316", "#64748b", "#84cc16", "#06b6d4", "#f43f5e",
];
export const OUTPUTS = [
  { key: "viewer", label: "Viewer", desc: "Tampilan timer layar penuh (confidence monitor)" },
  { key: "controller", label: "Controller", desc: "Kontrol penuh untuk kru produksi" },
  { key: "operator", label: "Operator", desc: "Kontrol sederhana untuk show caller" },
  { key: "agenda", label: "Agenda", desc: "Jadwal acara untuk staf & audiens" },
  { key: "moderator", label: "Moderator", desc: "Manajemen pesan untuk stage manager" },
];

export const pad = (n) => String(Math.floor(n)).padStart(2, "0");
export function fmt(totalSec) {
  const sign = totalSec < 0 ? "-" : "";
  let s = Math.abs(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return sign + `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
export function fmtFrac(totalSec) {
  const sign = totalSec < 0 ? "-" : "";
  let s = Math.abs(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const dec = Math.floor((s - Math.floor(s)) * 10);
  if (h > 0) return sign + `${pad(h)}:${pad(m)}:${pad(sec)}.${dec}`;
  return sign + `${pad(m)}:${pad(sec)}.${dec}`;
}
export function fmtClock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function computeTimer(t, now) {
  if (t.mode === MODE.CLOCK) return { display: fmtClock(new Date(now)), color: PLENTY_COLOR, remaining: 0, elapsed: 0, frac: 0 };
  if (t.mode === MODE.HIDDEN) return { display: "", color: PLENTY_COLOR, remaining: 0, elapsed: 0, frac: 0 };
  const elapsed = t.running ? (now - t.startEpoch) / 1000 : t.elapsedAtPause;
  if (t.mode === MODE.COUNTUP) {
    const over = elapsed - t.durationSec;
    let color = PLENTY_COLOR;
    if (over >= t.wrapRed * 60) color = DANGER_COLOR;
    else if (over >= t.wrapYellow * 60) color = WARNING_COLOR;
    const frac = t.durationSec > 0 ? Math.min(elapsed / t.durationSec, 1) : 0;
    return { display: fmt(elapsed), color, remaining: elapsed, elapsed, frac };
  }
  const remaining = t.durationSec - elapsed;
  let color = PLENTY_COLOR;
  if (remaining <= t.wrapRed * 60) color = DANGER_COLOR;
  else if (remaining <= t.wrapYellow * 60) color = WARNING_COLOR;
  const frac = t.durationSec > 0 ? Math.max(0, Math.min(elapsed / t.durationSec, 1)) : 0;
  return { display: fmt(remaining), color, remaining, elapsed, frac };
}
export const uid = () => Math.random().toString(36).slice(2, 9);
export function defaultTimer(over = {}) {
  return {
    id: uid(), title: "Sesi Baru", speaker: "", notes: "", durationSec: 600, finishTime: null,
    mode: MODE.COUNTDOWN, startType: "manual", startTime: null, linked: false,
    wrapYellow: 2, wrapRed: 1, color: LABEL_COLORS[0], running: false, startEpoch: null,
    elapsedAtPause: 0, chimeYellow: false, chimeRed: false, flashOnWrap: false, ...over,
  };
}

/* ============================ Stage (backdrop / bumpers / layout) ============================ */
export function defaultStageState() {
  return {
    stage: {
      backdrop: { type: "color", value: "#000000", opacity: 1 }, // type: color | gradient | image | video
      showLogo: false,
      logo: null, // dataURL
      bumpers: [], // { id, type:'image'|'video', src, x, y, w, h, name, show }
      layout: {
        logo: { x: 50, y: 7, w: 160, show: false },
        title: { x: 50, y: 24, size: 30 },
        timer: { x: 50, y: 48, size: 170 },
        speaker: { x: 50, y: 72, size: 30 },
        progress: { x: 50, y: 84, w: 55 },
        messages: { x: 50, y: 93 },
      },
    },
  };
}
