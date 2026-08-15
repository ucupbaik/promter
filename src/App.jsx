import { useState, useEffect, useRef, useCallback } from "react";
import {
  Timer as TimerIcon, Settings as SettingsIcon, Sun, Moon, Play, Pause, RotateCcw,
  SkipForward, Palette, MessageSquare, Monitor, Radio, Volume2, VolumeX, Maximize2,
  Clock, ArrowUp, ArrowDown, Plus, Trash2, Copy, GripVertical, Eye, Zap, Power,
  Users, X, Bold, Send, Download, Upload, Keyboard, List, Check, AlertTriangle,
  Circle, Minus, ChevronDown, Pencil, Flag, MonitorPlay, Share2, Link2, RefreshCw,
  Wifi, WifiOff, FileText, Layers, MoreVertical, QrCode, User, LogIn, Image as ImageIcon,
  Film, LayoutGrid, Move, Type, Square,
} from "lucide-react";
import {
  PLENTY_COLOR, WARNING_COLOR, DANGER_COLOR, MODE, MSG_COLORS, LABEL_COLORS, OUTPUTS,
  fmt, fmtFrac, fmtClock, computeTimer, uid, defaultTimer, defaultStageState,
} from "./stageShared";

/* ============================ Default room state ============================ */
function defaultState() {
  return {
    roomTitle: "Acara Live Saya",
    timers: [
      defaultTimer({ id: "t1", title: "Pembukaan", speaker: "MC", durationSec: 300, color: LABEL_COLORS[0] }),
      defaultTimer({ id: "t2", title: "Presentasi Utama", speaker: "Pembicara", durationSec: 1200, color: LABEL_COLORS[1] }),
      defaultTimer({ id: "t3", title: "Tanya Jawab", speaker: "Panel", durationSec: 600, color: LABEL_COLORS[2] }),
    ],
    activeId: "t1",
    blackout: false,
    onAir: false,
    follow: true,
    flashSignal: 0,
    messages: [
      { id: uid(), text: "Mohon ditutup dalam 1 menit", color: "white", bold: false, upper: false, flash: false, visible: false, focus: false },
      { id: uid(), text: "Waktu habis!", color: "red", bold: true, upper: true, flash: true, visible: false, focus: false },
    ],
    questions: [],
    logs: [],
    settings: { timezone: "Waktu Lokal", displayFormat: "24h", overtime: "stop" },
  };
}

/* ============================ App ============================ */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initialView = params.get("view") || "controller";
  const roomId = params.get("room") || "default";
  const myOutput = params.get("output") || (initialView === "viewer" ? "viewer" : "controller");

  /* ----------------------- Login gate ----------------------- */
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [loginView, setLoginView] = useState(initialView);
  const doLogin = (name, view) => { setUserName(name || "Kru"); setLoginView(view); setLoggedIn(true); };

  const [view, setView] = useState(initialView);
  const [dark, setDark] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connections, setConnections] = useState([]);
  const [apiToken, setApiToken] = useState("");

  const [state, setState] = useState(() => ({ ...defaultStageState(), ...defaultState() }));
  const [now, setNow] = useState(Date.now());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showConns, setShowConns] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showOutputLinks, setShowOutputLinks] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showStage, setShowStage] = useState(false);
  const [editingTimer, setEditingTimer] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [flashActive, setFlashActive] = useState(false);
  const [screens, setScreens] = useState([]);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [connId, setConnId] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const [saved, setSaved] = useState(false);

  const wsRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const updateState = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: "update", state: next }));
      }
      return next;
    });
  }, []);

  const updateStage = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, stage: { ...prev.stage, ...(typeof patch === "function" ? patch(prev.stage) : patch) } };
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: "stage-update", stage: next.stage }));
      }
      return next;
    });
  }, []);

  const hasInitRef = useRef(false);
  const reconnectRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const connIdRef = useRef(connId);
  connIdRef.current = connId;
  const lastFlashRef = useRef(0);
  const flashTimerRef = useRef(null);
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsHost = import.meta.env.DEV ? "localhost:3001" : window.location.host;
    let ws;
    const connect = () => {
      intentionalCloseRef.current = false;
      ws = new WebSocket(`${proto}://${wsHost}/ws?room=${encodeURIComponent(roomId)}&output=${myOutput}`);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); };
      ws.onclose = () => {
        if (intentionalCloseRef.current) return;
        if (ws !== wsRef.current) return;
        setConnected(false);
        clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connect, 1500);
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "init") {
            if (!hasInitRef.current) { setState(data.state); hasInitRef.current = true; }
            setConnections(data.connections || []);
            setApiToken(data.apiToken || "");
            const me = (data.connections || []).find((c) => c.output === myOutput);
            if (hasInitRef.current && me) { setConnId(me.id); setIdentifier(me.identifier || ""); }
          } else if (data.type === "state") {
            if (data.state.flashSignal && data.state.flashSignal !== lastFlashRef.current) {
              lastFlashRef.current = data.state.flashSignal;
              setFlashActive(true);
              clearTimeout(flashTimerRef.current);
              flashTimerRef.current = setTimeout(() => setFlashActive(false), 3000);
            }
            setState(data.state);
          } else if (data.type === "connections") {
            setConnections(data.connections || []);
            const me = (data.connections || []).find((c) => c.id === connIdRef.current);
            if (me) setIdentifier(me.identifier || "");
          } else if (data.type === "reload") {
            window.location.reload();
          } else if (data.type === "identify") {
            setFlashActive(true);
            setTimeout(() => setFlashActive(false), 3000);
          }
        } catch {}
      };
    };
    connect();
    return () => { intentionalCloseRef.current = true; clearTimeout(reconnectRef.current); ws.close(); };
  }, [roomId, myOutput]);

  // Auto-advance (linked) + scheduled start
  useEffect(() => {
    let changed = false;
    const next = state.timers.map((t, i) => {
      if (t.running) return t;
      if (t.startType === "linked" && i > 0) {
        const prev = state.timers[i - 1];
        const prevInfo = computeTimer(prev, now);
        if (!prev.running && prevInfo.elapsed >= prev.durationSec && prev.durationSec > 0) {
          changed = true;
          return { ...t, running: true, startEpoch: Date.now() };
        }
      }
      if (t.startType === "scheduled" && t.startTime) {
        const target = new Date(t.startTime).getTime();
        if (now >= target) { changed = true; return { ...t, running: true, startEpoch: Date.now() }; }
      }
      return t;
    });
    if (changed) updateState({ timers: next });
  }, [now, state.timers, updateState]);

  // Chime saat mencapai nol
  const lastChimeRef = useRef({});
  useEffect(() => {
    if (!soundOn) return;
    state.timers.forEach((t) => {
      if (t.mode === MODE.COUNTDOWN && t.running) {
        const { remaining } = computeTimer(t, now);
        if (remaining <= 0 && !lastChimeRef.current[t.id]) { lastChimeRef.current[t.id] = true; playChime(); }
        if (remaining > 1) lastChimeRef.current[t.id] = false;
      }
    });
  }, [now, state.timers, soundOn]);

  function playChime() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.start(); o.stop(ctx.currentTime + 0.6);
    } catch {}
  }

  /* ----------------------- Transport ----------------------- */
  const activeTimer = state.timers.find((t) => t.id === state.activeId) || null;
  const startTimer = (id) => updateState((s) => ({ ...s, timers: s.timers.map((t) => t.id === id && !t.running ? { ...t, running: true, startEpoch: Date.now() - t.elapsedAtPause * 1000 } : t) }));
  const pauseTimer = (id) => updateState((s) => ({ ...s, timers: s.timers.map((t) => { if (t.id !== id || !t.running) return t; const el = (Date.now() - t.startEpoch) / 1000; return { ...t, running: false, elapsedAtPause: el }; }) }));
  const resetTimer = (id) => updateState((s) => ({ ...s, timers: s.timers.map((t) => t.id === id ? { ...t, running: false, elapsedAtPause: 0, startEpoch: null } : t) }));
  const adjustTimer = (id, delta) => updateState((s) => ({ ...s, timers: s.timers.map((t) => { if (t.id !== id) return t; if (t.running) return { ...t, startEpoch: t.startEpoch - delta * 1000 }; return { ...t, elapsedAtPause: Math.max(0, t.elapsedAtPause + delta) }; }) }));
  const advanceTimer = () => { const idx = state.timers.findIndex((t) => t.id === state.activeId); if (idx >= 0 && idx < state.timers.length - 1) updateState({ activeId: state.timers[idx + 1].id }); };

  /* ----------------------- Timer CRUD ----------------------- */
  const addTimer = () => { const t = defaultTimer({ title: `Timer ${state.timers.length + 1}`, durationSec: 300 }); updateState((s) => ({ ...s, timers: [...s.timers, t], activeId: t.id })); };
  const deleteTimer = (id) => { updateState((s) => { const timers = s.timers.filter((t) => t.id !== id); const activeId = s.activeId === id ? (timers[0]?.id ?? null) : s.activeId; return { ...s, timers, activeId }; }); setSelected((sel) => sel.filter((x) => x !== id)); };
  const duplicateTimer = (id) => updateState((s) => { const idx = s.timers.findIndex((t) => t.id === id); if (idx < 0) return s; const copy = { ...s.timers[idx], id: uid(), running: false, elapsedAtPause: 0, startEpoch: null }; const timers = [...s.timers]; timers.splice(idx + 1, 0, copy); return { ...s, timers }; });
  const updateTimer = (id, patch) => updateState((s) => ({ ...s, timers: s.timers.map((t) => t.id === id ? { ...t, ...patch } : t) }));
  const moveTimer = (id, where, afterId) => updateState((s) => {
    const from = s.timers.findIndex((t) => t.id === id); if (from < 0) return s;
    const timers = [...s.timers]; const [m] = timers.splice(from, 1);
    if (where === "top") timers.unshift(m);
    else if (where === "bottom") timers.push(m);
    else if (where === "after" && afterId) { const to = timers.findIndex((t) => t.id === afterId); timers.splice(to + 1, 0, m); }
    return { ...s, timers };
  });

  /* ----------------------- Messages ----------------------- */
  const toggleMessage = (id) => updateState((s) => ({ ...s, messages: s.messages.map((m) => m.id === id ? { ...m, visible: !m.visible } : m) }));
  const addMessage = () => updateState((s) => ({ ...s, messages: [...s.messages, { id: uid(), text: "Pesan baru", color: "white", bold: false, upper: false, flash: false, visible: false, focus: false }] }));
  const updateMessage = (id, patch) => updateState((s) => ({ ...s, messages: s.messages.map((m) => m.id === id ? { ...m, ...patch } : m) }));
  const clearMessages = () => updateState((s) => ({ ...s, messages: s.messages.map((m) => ({ ...m, visible: false })) }));
  const flashMessage = (id) => { updateState((s) => ({ ...s, messages: s.messages.map((m) => m.id === id ? { ...m, visible: true } : m), flashSignal: (s.flashSignal || 0) + 1 })); if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "flash" })); };

  /* ----------------------- Questions ----------------------- */
  const addQuestion = (text, name) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "question-add", question: text, name })); };
  const updateQuestion = (id, patch) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "question-update", id, patch })); };
  const deleteQuestion = (id) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "question-delete", id })); };

  /* ----------------------- CSV ----------------------- */
  const exportCsv = () => {
    const rows = [["Title", "Speaker", "Notes", "Duration (sec)", "Mode", "Start Type", "Wrap Yellow", "Wrap Red"]];
    state.timers.forEach((t) => rows.push([t.title, t.speaker, t.notes, t.durationSec, t.mode, t.startType, t.wrapYellow, t.wrapRed]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "stagetimer-rundown.csv"; a.click();
  };
  const importCsv = (text) => {
    const lines = text.trim().split("\n"); const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
      if (cols.length < 4) continue;
      parsed.push(defaultTimer({ title: cols[0] || "Timer", speaker: cols[1] || "", notes: cols[2] || "", durationSec: parseInt(cols[3]) || 300 }));
    }
    if (parsed.length) updateState({ timers: parsed, activeId: parsed[0].id });
  };

  /* ----------------------- Drag reorder ----------------------- */
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    updateState((s) => { const from = s.timers.findIndex((t) => t.id === dragId); const to = s.timers.findIndex((t) => t.id === targetId); if (from < 0 || to < 0) return s; const timers = [...s.timers]; const [m] = timers.splice(from, 1); timers.splice(to, 0, m); return { ...s, timers }; });
    setDragId(null);
  };

  /* ----------------------- Keyboard ----------------------- */
  useEffect(() => {
    function onKey(e) {
      if (view !== "controller") return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space" && state.activeId) { e.preventDefault(); activeTimer?.running ? pauseTimer(state.activeId) : startTimer(state.activeId); }
      if (e.key === "r" && state.activeId) resetTimer(state.activeId);
      if (e.key === "n") addTimer();
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && selectMode) { e.preventDefault(); setSelected(state.timers.map((t) => t.id)); }
      if (e.key === "Backspace" && selectMode && selected.length) { e.preventDefault(); selected.forEach(deleteTimer); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, state.activeId, activeTimer, selectMode, selected]);

  /* ----------------------- Screen detection ----------------------- */
  const detectScreens = async () => {
    try {
      if (window.getScreenDetails) {
        const details = await window.getScreenDetails();
        setScreens(details.screens.map((s, i) => ({ id: s.id, label: `Layar ${i + 1}${s.isPrimary ? " (Utama)" : ""}`, isPrimary: s.isPrimary })));
        setShowScreenPicker(true);
      } else alert("Browser ini tidak mendukung deteksi multi-layar (butuh Chrome/Edge terbaru).");
    } catch { alert("Izin deteksi layar ditolak atau tidak didukung."); }
  };
  const openOnScreen = async (screenId) => {
    try {
      const details = await window.getScreenDetails();
      const screen = details.screens.find((s) => s.id === screenId);
      window.open(`${window.location.origin}${window.location.pathname}?view=viewer&room=${encodeURIComponent(roomId)}`, `stagetimer-viewer-${screenId}`, `left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`);
      setShowScreenPicker(false);
    } catch { alert("Gagal membuka di layar tersebut."); }
  };

  /* ----------------------- Connection actions ----------------------- */
  const connAction = (id, action) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "conn-action", id, action })); };
  const connActionAll = (action) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "conn-action-all", action })); };
  const updateIdentifier = (id, ident) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "conn-update", id, identifier: ident })); };

  /* ----------------------- Stage (backdrop / bumpers / layout) ----------------------- */
  const stage = state.stage || defaultStageState().stage;
  const updateBackdrop = (patch) => updateStage((s) => ({ ...s, backdrop: { ...s.backdrop, ...patch } }));
  const updateLayout = (key, patch) => updateStage((s) => ({ ...s, layout: { ...s.layout, [key]: { ...s.layout[key], ...patch } } }));
  const addBumper = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const isVideo = file.type.startsWith("video");
      const bumper = { id: uid(), type: isVideo ? "video" : "image", src: reader.result, name: file.name, x: 50, y: 50, w: isVideo ? 40 : 30, h: isVideo ? 40 : 30, show: true };
      updateStage((s) => ({ ...s, bumpers: [...s.bumpers, bumper] }));
    };
    reader.readAsDataURL(file);
  };
  const updateBumper = (id, patch) => updateStage((s) => ({ ...s, bumpers: s.bumpers.map((b) => b.id === id ? { ...b, ...patch } : b) }));
  const removeBumper = (id) => updateStage((s) => ({ ...s, bumpers: s.bumpers.filter((b) => b.id !== id) }));
  const onLogo = (file) => {
    const reader = new FileReader();
    reader.onload = () => updateStage({ logo: reader.result, showLogo: true });
    reader.readAsDataURL(file);
  };

  /* ============================ Render ============================ */
  const theme = dark
    ? { bg: "#0f1117", panel: "#171a23", border: "#262b38", text: "#e5e7eb", sub: "#9ca3af", accent: "#3b82f6" }
    : { bg: "#f3f4f6", panel: "#ffffff", border: "#e5e7eb", text: "#111827", sub: "#6b7280", accent: "#3b82f6" };

  if (!loggedIn) {
    return (<Login theme={theme} roomId={roomId} initialView={loginView} onLogin={doLogin} />);
  }

  if (view === "viewer") {
    return (<Viewer theme={theme} dark={dark} timer={activeTimer} now={now} blackout={state.blackout} onAir={state.onAir} flashActive={flashActive} messages={state.messages.filter((m) => m.visible)} stage={stage} onExit={() => setView("controller")} onFullscreen={() => viewerRef.current?.requestFullscreen?.()} viewerRef={viewerRef} />);
  }

  if (view === "questions") {
    return (<QuestionsPage theme={theme} roomId={roomId} onClose={() => setView("controller")} />);
  }

  const activeInfo = activeTimer ? computeTimer(activeTimer, now) : null;
  const totalDur = state.timers.reduce((a, t) => a + t.durationSec, 0) || 1;
  const activeIdx = state.timers.findIndex((x) => x.id === state.activeId);
  let totalElapsed = 0;
  state.timers.forEach((t, i) => { if (t.id === state.activeId) totalElapsed += computeTimer(t, now).elapsed; else if (i < activeIdx || state.activeId === null) totalElapsed += t.durationSec; });
  const roomFrac = Math.max(0, Math.min(totalElapsed / totalDur, 1));
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const viewerUrl = `${baseUrl}?view=viewer&room=${encodeURIComponent(roomId)}`;
  const outputUrl = (key) => `${baseUrl}?view=${key === "viewer" ? "viewer" : "controller"}&output=${key}&room=${encodeURIComponent(roomId)}`;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${theme.border}`, background: theme.panel, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TimerIcon color={theme.accent} size={22} />
          <input value={state.roomTitle} onChange={(e) => updateState({ roomTitle: e.target.value })} style={{ background: "transparent", border: "none", color: theme.text, fontSize: 18, fontWeight: 700, outline: "none", width: 240 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: connected ? "#22c55e" : "#ef4444", border: `1px solid ${connected ? "#22c55e" : "#ef4444"}`, padding: "2px 8px", borderRadius: 20 }}>{connected ? <Wifi size={11} /> : <WifiOff size={11} />} {connected ? "Online" : "Offline"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowOutputLinks(true)} style={btnStyle(theme, theme.accent)}><Share2 size={16} /> Output Links</button>
          <button onClick={() => setView("viewer")} style={btnStyle(theme, theme.accent)}><Monitor size={16} /> Tampilan Panggung</button>
          <button onClick={detectScreens} style={btnStyle(theme)} title="Buka di layar lain"><MonitorPlay size={16} /> Layar</button>
          <button onClick={() => setShowStage(true)} style={btnStyle(theme)} title="Atur backdrop, logo, bumper & layout"><LayoutGrid size={16} /> Tampilan</button>
          <button onClick={() => setDark((d) => !d)} style={btnStyle(theme)} title="Tema">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={() => setSoundOn((s) => !s)} style={btnStyle(theme)} title="Suara">{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowRoomMenu((v) => !v)} style={btnStyle(theme)}><SettingsIcon size={16} /> Room <ChevronDown size={14} /></button>
            {showRoomMenu && (<div style={menuStyle(theme)}>
              <MenuItem theme={theme} icon={<SettingsIcon size={15} />} label="Pengaturan Ruangan" onClick={() => { setShowSettings(true); setShowRoomMenu(false); }} />
              <MenuItem theme={theme} icon={<Radio size={15} />} label="API" onClick={() => { setShowApi(true); setShowRoomMenu(false); }} />
              <MenuItem theme={theme} icon={<FileText size={15} />} label="Logs" onClick={() => { setShowLogs(true); setShowRoomMenu(false); }} />
              <MenuItem theme={theme} icon={<Upload size={15} />} label="Impor CSV" onClick={() => { setShowCsv(true); setShowRoomMenu(false); }} />
              <MenuItem theme={theme} icon={<Download size={15} />} label="Ekspor CSV" onClick={() => { exportCsv(); setShowRoomMenu(false); }} />
              <MenuItem theme={theme} icon={<Keyboard size={15} />} label="Pintasan Keyboard" onClick={() => { setShowShortcuts(true); setShowRoomMenu(false); }} />
            </div>)}
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setUserMenu((v) => !v)} style={btnStyle(theme)}>{saved ? <User size={16} /> : <LogIn size={16} />} {saved ? userName : "Simpan"}</button>
            {userMenu && (<div style={menuStyle(theme)}>
              {saved ? (<MenuItem theme={theme} icon={<User size={15} />} label="Dashboard" onClick={() => setUserMenu(false)} />) : (<MenuItem theme={theme} icon={<LogIn size={15} />} label="Login / Buat Akun" onClick={() => { setSaved(true); setUserMenu(false); }} />)}
            </div>)}
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(380px, 1.4fr) minmax(240px, 0.9fr)", gap: 16, padding: 16, alignItems: "start" }}>
        {/* Kiri */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel theme={theme} title="Timer (Rundown)">
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button onClick={addTimer} style={btnStyle(theme, theme.accent)}><Plus size={15} /> Tambah Timer</button>
              <button onClick={() => setSelectMode((s) => !s)} style={btnStyle(theme, selectMode ? theme.accent : null)}><List size={15} /> {selectMode ? "Keluar" : "Pilih"}</button>
              <button onClick={() => updateState({ follow: !state.follow })} style={btnStyle(theme, state.follow ? theme.accent : null)} title="Auto-scroll ke timer aktif"><MoreVertical size={15} /> Follow</button>
            </div>
            {selectMode && selected.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => selected.forEach(deleteTimer)} style={btnStyle(theme, DANGER_COLOR)}><Trash2 size={14} /> Hapus</button>
                <button onClick={() => selected.forEach(duplicateTimer)} style={btnStyle(theme)}><Copy size={14} /> Duplikat</button>
                <button onClick={() => selected.forEach((id) => moveTimer(id, "top"))} style={btnStyle(theme)}><ArrowUp size={14} /> Atas</button>
                <button onClick={() => selected.forEach((id) => moveTimer(id, "bottom"))} style={btnStyle(theme)}><ArrowDown size={14} /> Bawah</button>
                <button onClick={() => selected.forEach((id) => updateTimer(id, { linked: !state.timers.find((t) => t.id === id)?.linked }))} style={btnStyle(theme)}><Link2 size={14} /> Link/Unlink</button>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.timers.map((t) => {
                const info = computeTimer(t, now);
                const isSel = selected.includes(t.id);
                return (
                  <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(t.id)}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) { setSelectMode(true); setSelected((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id])); return; }
                      if (selectMode) setSelected((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]));
                      else updateState({ activeId: t.id });
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: `1px solid ${state.activeId === t.id ? theme.accent : theme.border}`, background: state.activeId === t.id ? (dark ? "#1c2433" : "#eff6ff") : theme.panel, cursor: "pointer", opacity: isSel ? 0.6 : 1 }}>
                    <GripVertical size={16} color={theme.sub} />
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: theme.sub }}>{t.speaker || "—"} · {fmt(t.durationSec)}{t.linked ? " · linked" : ""}</div>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: info.color }}>{info.display}</span>
                    {state.activeId === t.id && (<div style={{ display: "flex", gap: 4 }}>
                      <IconBtn theme={theme} onClick={(e) => { e.stopPropagation(); t.running ? pauseTimer(t.id) : startTimer(t.id); }}><Play size={14} /></IconBtn>
                      <IconBtn theme={theme} onClick={(e) => { e.stopPropagation(); setEditingTimer(t.id); }}><Pencil size={14} /></IconBtn>
                      <IconBtn theme={theme} onClick={(e) => { e.stopPropagation(); flashMessageToScreen(t.id); }}><Zap size={14} /></IconBtn>
                      <IconBtn theme={theme} onClick={(e) => { e.stopPropagation(); deleteTimer(t.id); }}><Trash2 size={14} /></IconBtn>
                    </div>)}
                  </div>
                );
              })}
              {state.timers.length === 0 && <div style={{ color: theme.sub, fontSize: 13 }}>Belum ada timer. Klik "Tambah Timer".</div>}
            </div>
          </Panel>

          <Panel theme={theme} title="Pesan ke Panggung">
            <button onClick={addMessage} style={{ ...btnStyle(theme, theme.accent), marginBottom: 10 }}><Plus size={15} /> Tambah Pesan</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.messages.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: MSG_COLORS[m.color].value }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: m.bold ? 700 : 400, textTransform: m.upper ? "uppercase" : "none" }}>{m.text}</span>
                  <IconBtn theme={theme} active={m.visible} onClick={() => toggleMessage(m.id)}><Eye size={14} /></IconBtn>
                  <IconBtn theme={theme} active={m.bold} onClick={() => updateMessage(m.id, { bold: !m.bold })}><Bold size={14} /></IconBtn>
                  <IconBtn theme={theme} active={m.upper} onClick={() => updateMessage(m.id, { upper: !m.upper })}><span style={{ fontSize: 11, fontWeight: 800 }}>AA</span></IconBtn>
                  <IconBtn theme={theme} active={m.flash} onClick={() => updateMessage(m.id, { flash: !m.flash })}><Zap size={14} /></IconBtn>
                  <IconBtn theme={theme} active={m.focus} onClick={() => updateMessage(m.id, { focus: !m.focus })}><Circle size={14} /></IconBtn>
                  <IconBtn theme={theme} onClick={() => flashMessage(m.id)}><Send size={14} /></IconBtn>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={clearMessages} style={{ ...btnStyle(theme) }}><X size={14} /> Sembunyikan Semua</button>
              <button onClick={() => setShowQuestions(true)} style={{ ...btnStyle(theme, theme.accent) }}><QrCode size={14} /> Submit Questions</button>
            </div>
          </Panel>

          <Panel theme={theme} title="Progres Acara">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.sub, marginBottom: 6 }}>
              <span>{fmt(totalElapsed)}</span><span>{fmt(totalDur - totalElapsed)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: theme.border, overflow: "hidden" }}>
              <div style={{ width: `${roomFrac * 100}%`, height: "100%", background: theme.accent, transition: "width 0.3s" }} />
            </div>
          </Panel>
        </div>

        {/* Tengah */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel theme={theme} title="Pratinjau Panggung">
            {activeTimer ? (
              <div style={{ background: "#000", borderRadius: 12, padding: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ fontSize: 14, color: "#9ca3af" }}>{activeTimer.title}</div>
                <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 72, color: activeInfo.color, lineHeight: 1.1, margin: "8px 0" }}>{activeInfo.display}</div>
                <div style={{ fontSize: 14, color: "#9ca3af" }}>{activeTimer.speaker}</div>
                {state.onAir && (<div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 6, color: DANGER_COLOR, fontWeight: 700, fontSize: 13 }}><Circle size={10} fill={DANGER_COLOR} /> ON AIR</div>)}
                <svg width="100%" height="8" style={{ marginTop: 14 }}><rect width="100%" height="8" rx="4" fill="#1f2937" /><rect width={`${activeInfo.frac * 100}%`} height="8" rx="4" fill={activeInfo.color} /></svg>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: activeTimer.running ? DANGER_COLOR : "#374151" }} />
                  <span style={{ fontFamily: "monospace", fontSize: 18, color: "#e5e7eb" }}>{fmtFrac(activeInfo.remaining)}</span>
                </div>
              </div>
            ) : (<div style={{ color: theme.sub }}>Pilih atau tambah timer.</div>)}
          </Panel>

          <Panel theme={theme} title="Kontrol Transport">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => state.activeId && (activeTimer?.running ? pauseTimer(state.activeId) : startTimer(state.activeId))} disabled={!state.activeId} style={{ ...btnStyle(theme, theme.accent), opacity: state.activeId ? 1 : 0.5 }}>{activeTimer?.running ? <Pause size={16} /> : <Play size={16} />} {activeTimer?.running ? "Jeda" : "Mulai"}</button>
              <button onClick={() => state.activeId && resetTimer(state.activeId)} disabled={!state.activeId} style={{ ...btnStyle(theme), opacity: state.activeId ? 1 : 0.5 }}><RotateCcw size={16} /> Reset</button>
              <button onClick={advanceTimer} disabled={!state.activeId} style={{ ...btnStyle(theme), opacity: state.activeId ? 1 : 0.5 }}><SkipForward size={16} /> Lanjut</button>
              <div style={{ position: "relative", display: "inline-flex" }}>
                <button onClick={() => state.activeId && adjustTimer(state.activeId, -60)} style={btnStyle(theme)}><Minus size={14} />1m</button>
                <button onClick={() => state.activeId && adjustTimer(state.activeId, 60)} style={btnStyle(theme)}><Plus size={14} />1m</button>
                <select onChange={(e) => { if (state.activeId && e.target.value) adjustTimer(state.activeId, Number(e.target.value)); e.target.value = ""; }} defaultValue="" style={{ ...btnStyle(theme), paddingLeft: 6 }}>
                  <option value="" disabled>⋯</option>
                  <option value="-600">-10m</option><option value="-300">-5m</option><option value="-60">-1m</option><option value="-10">-10s</option><option value="-1">-1s</option>
                  <option value="1">+1s</option><option value="10">+10s</option><option value="60">+1m</option><option value="300">+5m</option><option value="600">+10m</option>
                </select>
              </div>
              <button onClick={() => updateState({ onAir: !state.onAir })} style={btnStyle(theme, state.onAir ? DANGER_COLOR : null)}><Power size={16} /> {state.onAir ? "ON AIR" : "Off Air"}</button>
            </div>
            {activeTimer && (
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 14, borderRadius: 7, background: theme.border, position: "relative", cursor: "pointer" }}
                  onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const frac = (e.clientX - rect.left) / rect.width; const target = frac * activeTimer.durationSec; updateState((s) => ({ ...s, timers: s.timers.map((t) => t.id === state.activeId ? { ...t, elapsedAtPause: target, startEpoch: t.running ? Date.now() - target * 1000 : null } : t) })); }}>
                  <div style={{ width: `${activeInfo.frac * 100}%`, height: "100%", borderRadius: 7, background: activeInfo.color }} />
                  <div style={{ position: "absolute", top: -3, left: `${activeInfo.frac * 100}%`, width: 4, height: 20, background: "#fff", borderRadius: 2, transform: "translateX(-50%)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.sub, marginTop: 6 }}>
                  <span>0:00</span><span>{fmt(activeTimer.durationSec)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.sub, marginTop: 8, fontFamily: "monospace" }}>
                  <span>Sekarang: {fmtClock(new Date(now))}</span>
                  <span>Mulai: {activeTimer.running ? fmtClock(new Date(activeTimer.startEpoch)) : "--:--:--"}</span>
                  <span>Selesai: {activeTimer.running ? fmtClock(new Date(activeTimer.startEpoch + activeTimer.durationSec * 1000)) : "--:--:--"}</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel theme={theme} title="Blackout & Flash">
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => updateState({ blackout: !state.blackout })} style={btnStyle(theme, state.blackout ? "#111" : null)}><Power size={16} /> {state.blackout ? "Blackout AKTIF" : "Blackout"}</button>
              <button onClick={() => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "flash" })); updateState((s) => ({ ...s, flashSignal: (s.flashSignal || 0) + 1 })); }} style={btnStyle(theme, WARNING_COLOR)}><Zap size={16} /> Flash Layar</button>
            </div>
          </Panel>
        </div>

        {/* Kanan */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel theme={theme} title="Koneksi Langsung">
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.sub, fontSize: 13 }}>
              <Users size={16} /> <span style={{ fontWeight: 700, color: theme.text }}>{connections.length}</span> perangkat terhubung
            </div>
            <button onClick={() => setShowConns(true)} style={{ ...btnStyle(theme), marginTop: 8, width: "100%", justifyContent: "center" }}><Link2 size={14} /> Kelola Koneksi</button>
            <div style={{ marginTop: 8, fontSize: 12, color: theme.sub }}>Buka <b>Output Links</b> di HP/laptop lain untuk kontrol jarak jauh. Semua perangkat sinkron real-time.</div>
            <div style={{ marginTop: 8, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 12 }}>🟢 Controller (perangkat ini)</div>
          </Panel>
          <Panel theme={theme} title="Pertanyaan Audiens">
            <div style={{ fontSize: 13, color: theme.sub, marginBottom: 8 }}>{state.questions.length} pertanyaan masuk</div>
            <button onClick={() => setShowQuestions(true)} style={{ ...btnStyle(theme, theme.accent), width: "100%", justifyContent: "center" }}><QrCode size={14} /> Buka & Bagikan</button>
          </Panel>
          <Panel theme={theme} title="Pintasan Cepat">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <Shortcut k="Spasi" d="Mulai / Jeda timer aktif" />
              <Shortcut k="R" d="Reset timer aktif" />
              <Shortcut k="N" d="Timer baru" />
              <Shortcut k="Ctrl+A" d="Pilih semua (mode pilih)" />
              <Shortcut k="Del" d="Hapus terpilih" />
            </div>
          </Panel>
        </div>
      </div>

      {/* Modals */}
      {editingTimer && (<TimerModal theme={theme} timer={state.timers.find((t) => t.id === editingTimer)} onClose={() => setEditingTimer(null)} onSave={(patch) => { updateTimer(editingTimer, patch); setEditingTimer(null); }} />)}
      {showStage && (<StageModal theme={theme} stage={stage} updateStage={updateStage} updateBackdrop={updateBackdrop} updateLayout={updateLayout} addBumper={addBumper} updateBumper={updateBumper} removeBumper={removeBumper} onLogo={onLogo} onClose={() => setShowStage(false)} />)}
      {showSettings && <SettingsModal theme={theme} state={state} updateState={updateState} onClose={() => setShowSettings(false)} />}
      {showCsv && (<Modal theme={theme} title="Impor CSV" onClose={() => setShowCsv(false)}>
        <p style={{ fontSize: 13, color: theme.sub }}>Tempel baris CSV (judul,speaker,catatan,durasi_detik). Baris pertama header.</p>
        <textarea id="csvArea" rows={6} style={{ width: "100%", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 8, fontFamily: "monospace" }} />
        <button onClick={() => { const el = document.getElementById("csvArea"); importCsv(el.value); setShowCsv(false); }} style={{ ...btnStyle(theme, theme.accent), marginTop: 10 }}>Impor</button>
      </Modal>)}
      {showShortcuts && (<Modal theme={theme} title="Pintasan Keyboard" onClose={() => setShowShortcuts(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Shortcut k="Spasi" d="Mulai / Jeda" /><Shortcut k="R" d="Reset" /><Shortcut k="N" d="Timer baru" /><Shortcut k="Ctrl+A" d="Pilih semua" /><Shortcut k="Del" d="Hapus terpilih" />
        </div>
      </Modal>)}
      {showOutputLinks && (<Modal theme={theme} title="Output Links" onClose={() => setShowOutputLinks(false)}>
        <p style={{ fontSize: 13, color: theme.sub }}>Setiap link sinkron real-time. Buka di perangkat berbeda (HP, laptop, layar panggung).</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {OUTPUTS.map((o) => (
            <div key={o.key} style={{ padding: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.panel }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{o.label}</span>
                <span style={{ fontSize: 12, color: theme.sub }}>{o.desc}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={outputUrl(o.key)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 12 }} />
                <button onClick={() => navigator.clipboard.writeText(outputUrl(o.key))} style={btnStyle(theme, theme.accent)}><Copy size={14} /></button>
                <button onClick={() => window.open(outputUrl(o.key), "_blank")} style={btnStyle(theme)}><Monitor size={14} /></button>
              </div>
              <div style={{ marginTop: 6 }}>
                <input placeholder="Identifier (mis. Stage Left)" value={connId && myOutput === o.key ? identifier : ""} onChange={(e) => { if (connId && myOutput === o.key) setIdentifier(e.target.value); else updateIdentifier(connId, e.target.value); }} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 12 }} />
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: theme.sub, marginTop: 10 }}>Room ID: <code>{roomId}</code></p>
      </Modal>)}
      {showConns && (<Modal theme={theme} title="Koneksi Langsung" onClose={() => setShowConns(false)}>
        <p style={{ fontSize: 13, color: theme.sub }}>Perangkat terhubung (dikelompokkan per output):</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {connections.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <div style={{ flex: 1 }}>
                <input value={c.id === connId ? identifier : (c.identifier || "")} onChange={(e) => { if (c.id === connId) setIdentifier(e.target.value); else updateIdentifier(c.id, e.target.value); }} placeholder={c.output} style={{ width: "100%", background: "transparent", border: "none", color: theme.text, fontSize: 13, outline: "none" }} />
                <div style={{ fontSize: 11, color: theme.sub }}>{c.output} · {c.transport} · {Math.round((Date.now() - c.connectedAt) / 1000)}s</div>
              </div>
              <IconBtn theme={theme} onClick={() => connAction(c.id, "flash")}><Zap size={14} /></IconBtn>
              <IconBtn theme={theme} onClick={() => connAction(c.id, "reload")}><RefreshCw size={14} /></IconBtn>
              <IconBtn theme={theme} onClick={() => connAction(c.id, "disconnect")}><X size={14} /></IconBtn>
            </div>
          ))}
          {connections.length === 0 && <div style={{ color: theme.sub, fontSize: 13 }}>Belum ada koneksi.</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => connActionAll("reload")} style={btnStyle(theme)}><RefreshCw size={14} /> Muat Ulang Semua</button>
          <button onClick={() => connActionAll("disconnect")} style={btnStyle(theme, DANGER_COLOR)}><X size={14} /> Putuskan Semua</button>
        </div>
      </Modal>)}
      {showApi && (<Modal theme={theme} title="API Ruangan" onClose={() => setShowApi(false)}>
        <p style={{ fontSize: 13, color: theme.sub }}>Gunakan token ini untuk mengontrol via skrip (Companion, vMix, dll):</p>
        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <input readOnly value={apiToken} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 13, fontFamily: "monospace" }} />
          <button onClick={() => navigator.clipboard.writeText(apiToken)} style={btnStyle(theme, theme.accent)}>Salin</button>
        </div>
        <pre style={{ background: theme.bg, padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto", color: theme.sub }}>{`POST /api/${roomId}/timer/start?token=...
POST /api/${roomId}/timer/pause?token=...
POST /api/${roomId}/timer/reset?token=...
POST /api/${roomId}/timer/adjust?token=...&delta=-60
POST /api/${roomId}/blackout?token=...&value=true
POST /api/${roomId}/flash?token=...`}</pre>
      </Modal>)}
      {showLogs && (<Modal theme={theme} title="Logs Aktivitas" onClose={() => setShowLogs(false)}>
        <div style={{ maxHeight: 300, overflow: "auto", display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          {state.logs.slice().reverse().map((l, i) => (<div key={i} style={{ display: "flex", gap: 8 }}><span style={{ color: theme.sub }}>{fmtClock(new Date(l.t))}</span><span>{l.text}</span></div>))}
          {state.logs.length === 0 && <div style={{ color: theme.sub }}>Belum ada log.</div>}
        </div>
        <button onClick={() => { const txt = state.logs.map((l) => `${fmtClock(new Date(l.t))} ${l.text}`).join("\n"); const b = new Blob([txt], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "logs.txt"; a.click(); }} style={{ ...btnStyle(theme, theme.accent), marginTop: 10 }}>Unduh Logs</button>
      </Modal>)}
      {showQuestions && (<Modal theme={theme} title="Submit Questions" onClose={() => setShowQuestions(false)}>
        <p style={{ fontSize: 13, color: theme.sub }}>Bagikan link ini ke audiens untuk mengirim pertanyaan:</p>
        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <input readOnly value={`${baseUrl}?view=questions&room=${encodeURIComponent(roomId)}`} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 12 }} />
          <button onClick={() => navigator.clipboard.writeText(`${baseUrl}?view=questions&room=${encodeURIComponent(roomId)}`)} style={btnStyle(theme, theme.accent)}>Salin</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {state.questions.map((q) => (
            <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel }}>
              <span style={{ flex: 1, fontSize: 13 }}>{q.text}{q.name ? ` — ${q.name}` : ""}</span>
              <IconBtn theme={theme} active={q.answered} onClick={() => updateQuestion(q.id, { answered: !q.answered })}><Check size={14} /></IconBtn>
              <IconBtn theme={theme} onClick={() => deleteQuestion(q.id)}><X size={14} /></IconBtn>
            </div>
          ))}
          {state.questions.length === 0 && <div style={{ color: theme.sub, fontSize: 13 }}>Belum ada pertanyaan.</div>}
        </div>
      </Modal>)}
      {showScreenPicker && (<Modal theme={theme} title="Pilih Layar Tujuan" onClose={() => setShowScreenPicker(false)}>
        <p style={{ fontSize: 13, color: theme.sub }}>Pilih layar untuk menampilkan mode panggung fullscreen:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {screens.map((s) => (<button key={s.id} onClick={() => openOnScreen(s.id)} style={{ ...btnStyle(theme), justifyContent: "flex-start" }}><MonitorPlay size={16} /> {s.label}</button>))}
        </div>
      </Modal>)}
    </div>
  );

  function flashMessageToScreen(id) {
    updateState((s) => ({ ...s, flashSignal: (s.flashSignal || 0) + 1 }));
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "flash" }));
  }
}

/* ============================ Login ============================ */
function Login({ theme, roomId, initialView, onLogin }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(roomId === "default" ? "" : roomId);
  const [view, setView] = useState(initialView);
  const submit = (e) => { e.preventDefault(); onLogin(name.trim(), view); };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0f1117,#1a1f2e)", fontFamily: "Inter, system-ui, sans-serif", padding: 20 }}>
      <form onSubmit={submit} style={{ width: 380, maxWidth: "92vw", background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <TimerIcon color={theme.accent} size={26} />
          <h1 style={{ margin: 0, fontSize: 22, color: theme.text }}>Stage Timer</h1>
        </div>
        <p style={{ fontSize: 13, color: theme.sub, marginBottom: 22 }}>Masuk ke ruangan untuk mengontrol atau menampilkan timer.</p>
        <Field label="Nama Anda"><input style={inputStyle(theme)} placeholder="mis. Kru Produksi" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Kode Ruangan"><input style={inputStyle(theme)} placeholder="default" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} /></Field>
        <Field label="Tampilan">
          <select style={inputStyle(theme)} value={view} onChange={(e) => setView(e.target.value)}>
            <option value="controller">Controller (Kontrol Penuh)</option>
            <option value="viewer">Viewer (Tampilan Panggung)</option>
            <option value="operator">Operator (Show Caller)</option>
            <option value="agenda">Agenda</option>
            <option value="moderator">Moderator</option>
          </select>
        </Field>
        <button type="submit" style={{ ...btnStyle(theme, theme.accent), width: "100%", justifyContent: "center", marginTop: 18 }}><LogIn size={16} /> Masuk</button>
        <p style={{ fontSize: 11, color: theme.sub, marginTop: 14, textAlign: "center" }}>Semua perangkat dengan kode ruangan sama akan sinkron real-time.</p>
      </form>
    </div>
  );
}

/* ============================ Stage Modal ============================ */
function StageModal({ theme, stage, updateStage, updateBackdrop, updateLayout, addBumper, updateBumper, removeBumper, onLogo, onClose }) {
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const onFile = (e) => { if (e.target.files[0]) addBumper(e.target.files[0]); e.target.value = ""; };
  const onLogoFile = (e) => { if (e.target.files[0]) onLogo(e.target.files[0]); e.target.value = ""; };
  return (
    <Modal theme={theme} title="Atur Tampilan Panggung" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Backdrop */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Backdrop</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {["color", "gradient", "image", "video"].map((t) => (
              <button key={t} onClick={() => updateBackdrop({ type: t })} style={btnStyle(theme, stage.backdrop.type === t ? theme.accent : null)}>{t === "color" ? "Warna" : t === "gradient" ? "Gradien" : t === "image" ? "Gambar" : "Video"}</button>
            ))}
          </div>
          {stage.backdrop.type === "color" && (<input type="color" value={stage.backdrop.value} onChange={(e) => updateBackdrop({ value: e.target.value })} style={{ width: 60, height: 36, border: "none", background: "none" }} />)}
          {stage.backdrop.type === "gradient" && (<div style={{ display: "flex", gap: 8 }}><input type="color" value={stage.backdrop.value.split("|")[0] || "#1e3a8a"} onChange={(e) => { const parts = (stage.backdrop.value || "#1e3a8a|#000000").split("|"); updateBackdrop({ value: `${e.target.value}|${parts[1] || "#000000"}` }); }} style={{ width: 50, height: 34, border: "none" }} /><input type="color" value={stage.backdrop.value.split("|")[1] || "#000000"} onChange={(e) => { const parts = (stage.backdrop.value || "#1e3a8a|#000000").split("|"); updateBackdrop({ value: `${parts[0] || "#1e3a8a"}|${e.target.value}` }); }} style={{ width: 50, height: 34, border: "none" }} /></div>)}
          {(stage.backdrop.type === "image" || stage.backdrop.type === "video") && (<div style={{ display: "flex", gap: 8, alignItems: "center" }}><button onClick={() => fileRef.current?.click()} style={btnStyle(theme, theme.accent)}><ImageIcon size={14} /> Pilih {stage.backdrop.type === "image" ? "Gambar" : "Video"}</button><input ref={fileRef} type="file" accept={stage.backdrop.type === "image" ? "image/*" : "video/*"} onChange={onFile} style={{ display: "none" }} /></div>)}
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 12, color: theme.sub }}>Opacity: {Math.round((stage.backdrop.opacity ?? 1) * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={stage.backdrop.opacity ?? 1} onChange={(e) => updateBackdrop({ opacity: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
        </div>

        {/* Logo */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Logo</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => logoRef.current?.click()} style={btnStyle(theme, theme.accent)}><ImageIcon size={14} /> Unggah Logo</button>
            <input ref={logoRef} type="file" accept="image/*" onChange={onLogoFile} style={{ display: "none" }} />
            {stage.logo && (<><button onClick={() => updateStage({ logo: null, showLogo: false })} style={btnStyle(theme)}>Hapus</button><label style={{ fontSize: 12, color: theme.sub, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={stage.showLogo} onChange={(e) => updateStage({ showLogo: e.target.checked })} /> Tampilkan</label></>)}
          </div>
        </div>

        {/* Bumpers */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Bumper (Logo / Gambar / Video)</div>
          <button onClick={() => fileRef.current?.click()} style={{ ...btnStyle(theme, theme.accent), marginBottom: 10 }}><Film size={14} /> Tambah Bumper</button>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stage.bumpers.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.panel }}>
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                <label style={{ fontSize: 12, color: theme.sub, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={b.show} onChange={(e) => updateBumper(b.id, { show: e.target.checked })} /> Tampil</label>
                <IconBtn theme={theme} onClick={() => removeBumper(b.id)}><X size={14} /></IconBtn>
              </div>
            ))}
            {stage.bumpers.length === 0 && <div style={{ color: theme.sub, fontSize: 13 }}>Belum ada bumper.</div>}
          </div>
        </div>

        {/* Layout */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Layout (posisi & ukuran)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "title", label: "Judul" },
              { key: "timer", label: "Timer" },
              { key: "speaker", label: "Pembicara" },
              { key: "progress", label: "Progress" },
              { key: "messages", label: "Pesan" },
            ].map(({ key, label }) => {
              const l = stage.layout[key];
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 80, fontSize: 13 }}>{label}</span>
                  <label style={{ fontSize: 12, color: theme.sub }}>X<input type="range" min="0" max="100" value={l.x} onChange={(e) => updateLayout(key, { x: Number(e.target.value) })} style={{ width: 90 }} /></label>
                  <label style={{ fontSize: 12, color: theme.sub }}>Y<input type="range" min="0" max="100" value={l.y} onChange={(e) => updateLayout(key, { y: Number(e.target.value) })} style={{ width: 90 }} /></label>
                  {(key === "title" || key === "timer" || key === "speaker") && (<label style={{ fontSize: 12, color: theme.sub }}>Uk<input type="range" min="14" max={key === "timer" ? 260 : 60} value={l.size} onChange={(e) => updateLayout(key, { size: Number(e.target.value) })} style={{ width: 90 }} /></label>)}
                  {key === "progress" && (<label style={{ fontSize: 12, color: theme.sub }}>Lbr<input type="range" min="20" max="100" value={l.w} onChange={(e) => updateLayout(key, { w: Number(e.target.value) })} style={{ width: 90 }} /></label>)}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: theme.sub, marginTop: 8 }}>Di layar panggung, elemen juga bisa digeser langsung dengan mouse.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ============================ Sub-components ============================ */
function btnStyle(theme, accent) {
  return { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: `1px solid ${accent ? accent : theme.border}`, background: accent ? accent : theme.panel, color: accent ? "#fff" : theme.text, fontSize: 13, fontWeight: 600, cursor: "pointer" };
}
function IconBtn({ theme, onClick, children, active }) {
  return (<button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: `1px solid ${active ? theme.accent : theme.border}`, background: active ? theme.accent : theme.panel, color: active ? "#fff" : theme.text, cursor: "pointer" }}>{children}</button>);
}
function Panel({ theme, title, children }) {
  return (<div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: theme.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>{title}</div>{children}</div>);
}
function MenuItem({ theme, icon, label, onClick }) {
  return (<div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderRadius: 8, color: theme.text }} onMouseEnter={(e) => (e.currentTarget.style.background = theme.bg)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{icon} <span style={{ fontSize: 14 }}>{label}</span></div>);
}
function menuStyle(theme) {
  return { position: "absolute", top: 44, right: 0, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 6, minWidth: 220, zIndex: 50, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" };
}
function Shortcut({ k, d }) {
  return (<div style={{ display: "flex", alignItems: "center", gap: 10 }}><kbd style={{ background: "#1f2937", color: "#e5e7eb", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontFamily: "monospace", minWidth: 48, textAlign: "center" }}>{k}</kbd><span style={{ color: "#9ca3af" }}>{d}</span></div>);
}
function Modal({ theme, title, children, onClose }) {
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
    <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, width: 520, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3><button onClick={onClose} style={{ background: "transparent", border: "none", color: theme.sub, cursor: "pointer" }}><X size={18} /></button></div>
      {children}
    </div>
  </div>);
}
function TimerModal({ theme, timer, onClose, onSave }) {
  const [title, setTitle] = useState(timer.title);
  const [speaker, setSpeaker] = useState(timer.speaker);
  const [notes, setNotes] = useState(timer.notes || "");
  const [duration, setDuration] = useState(timer.durationSec);
  const [mode, setMode] = useState(timer.mode);
  const [startType, setStartType] = useState(timer.startType);
  const [startTime, setStartTime] = useState(timer.startTime || "");
  const [wrapYellow, setWrapYellow] = useState(timer.wrapYellow);
  const [wrapRed, setWrapRed] = useState(timer.wrapRed);
  const [color, setColor] = useState(timer.color);
  const [chimeYellow, setChimeYellow] = useState(timer.chimeYellow);
  const [chimeRed, setChimeRed] = useState(timer.chimeRed);
  const [flashOnWrap, setFlashOnWrap] = useState(timer.flashOnWrap);
  return (
    <Modal theme={theme} title="Edit Timer" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Judul"><input style={inputStyle(theme)} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Pembicara"><input style={inputStyle(theme)} value={speaker} onChange={(e) => setSpeaker(e.target.value)} /></Field>
        <Field label="Catatan"><input style={inputStyle(theme)} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Field label="Durasi (detik)"><input type="number" style={inputStyle(theme)} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} /></Field>
        <Field label="Mode Tampilan"><select style={inputStyle(theme)} value={mode} onChange={(e) => setMode(e.target.value)}><option value="countdown">Countdown</option><option value="countup">Count Up</option><option value="clock">Jam</option><option value="hidden">Hidden</option></select></Field>
        <Field label="Tipe Mulai"><select style={inputStyle(theme)} value={startType} onChange={(e) => setStartType(e.target.value)}><option value="manual">Manual</option><option value="linked">Linked (otomatis setelah sebelumnya)</option><option value="scheduled">Scheduled (waktu tertentu)</option></select></Field>
        {startType === "scheduled" && <Field label="Waktu Mulai"><input type="datetime-local" style={inputStyle(theme)} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>}
        <Field label="Wrap-up Kuning (menit)"><input type="number" style={inputStyle(theme)} value={wrapYellow} onChange={(e) => setWrapYellow(parseInt(e.target.value) || 0)} /></Field>
        <Field label="Wrap-up Merah (menit)"><input type="number" style={inputStyle(theme)} value={wrapRed} onChange={(e) => setWrapRed(parseInt(e.target.value) || 0)} /></Field>
        <Field label="Aksi Wrap-up">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={chimeYellow} onChange={(e) => setChimeYellow(e.target.checked)} /> Chime kuning</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={chimeRed} onChange={(e) => setChimeRed(e.target.checked)} /> Chime merah</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={flashOnWrap} onChange={(e) => setFlashOnWrap(e.target.checked)} /> Flash saat wrap</label>
          </div>
        </Field>
        <Field label="Warna Label"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{LABEL_COLORS.map((c) => (<button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: color === c ? "3px solid #fff" : "none", cursor: "pointer" }} />))}</div></Field>
        <button onClick={() => onSave({ title, speaker, notes, durationSec: duration, mode, startType, startTime: startTime ? new Date(startTime).toISOString() : null, wrapYellow, wrapRed, color, chimeYellow, chimeRed, flashOnWrap })} style={{ ...btnStyle(theme, theme.accent), justifyContent: "center" }}>Simpan</button>
      </div>
    </Modal>
  );
}
function SettingsModal({ theme, state, updateState, onClose }) {
  return (<Modal theme={theme} title="Pengaturan Ruangan" onClose={onClose}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Field label="Zona Waktu"><select style={inputStyle(theme)} value={state.settings.timezone} onChange={(e) => updateState((s) => ({ ...s, settings: { ...s.settings, timezone: e.target.value } }))}><option>Waktu Lokal</option><option>UTC</option></select></Field>
    <Field label="Format Tampilan"><select style={inputStyle(theme)} value={state.settings.displayFormat} onChange={(e) => updateState((s) => ({ ...s, settings: { ...s.settings, displayFormat: e.target.value } }))}><option value="24h">24 Jam</option><option value="12h">12 Jam</option></select></Field>
    <Field label="Overtime"><select style={inputStyle(theme)} value={state.settings.overtime} onChange={(e) => updateState((s) => ({ ...s, settings: { ...s.settings, overtime: e.target.value } }))}><option value="stop">Berhenti di nol</option><option value="continue">Lanjut hitung</option><option value="hide">Sembunyikan</option></select></Field>
  </div></Modal>);
}
function Field({ label, children }) {
  return (<div><label style={{ display: "block", fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{label}</label>{children}</div>);
}
function inputStyle(theme) {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 14, outline: "none" };
}

/* ============================ Questions Page ============================ */
function QuestionsPage({ theme, roomId, onClose }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const submit = () => {
    if (!text.trim()) return;
    try {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws?room=${encodeURIComponent(roomId)}&output=questions`);
      ws.onopen = () => { ws.send(JSON.stringify({ type: "question-add", question: text.trim(), name: name.trim() })); setTimeout(() => { ws.close(); setSent(true); }, 300); };
    } catch { setSent(true); }
  };
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: 420, maxWidth: "90vw", background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 28 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Kirim Pertanyaan</h2>
        <p style={{ fontSize: 13, color: theme.sub, marginBottom: 18 }}>Pertanyaan akan muncul di layar moderator.</p>
        {sent ? (<div style={{ textAlign: "center", padding: 20 }}><Check size={40} color="#22c55e" /><div style={{ marginTop: 10, fontWeight: 600 }}>Terkirim!</div><button onClick={onClose} style={{ ...btnStyle(theme, theme.accent), marginTop: 16 }}>Tutup</button></div>)
          : (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={inputStyle(theme)} placeholder="Nama (opsional)" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea rows={4} style={inputStyle(theme)} placeholder="Tulis pertanyaan..." value={text} onChange={(e) => setText(e.target.value)} />
            <button onClick={submit} style={{ ...btnStyle(theme, theme.accent), justifyContent: "center" }}><Send size={16} /> Kirim</button>
          </div>)}
      </div>
    </div>
  );
}

/* ============================ Viewer ============================ */
function Viewer({ theme, dark, timer, now, blackout, onAir, flashActive, messages, stage, onExit, onFullscreen, viewerRef }) {
  const [drag, setDrag] = useState(null);
  const layout = stage?.layout || defaultStageState().stage.layout;
  const backdrop = stage?.backdrop || { type: "color", value: "#000000", opacity: 1 };
  const [liveLayout, setLiveLayout] = useState(layout);
  useEffect(() => setLiveLayout(layout), [layout]);

  const backdropStyle = (() => {
    if (backdrop.type === "color") return { background: backdrop.value };
    if (backdrop.type === "gradient") { const [a, b] = (backdrop.value || "#1e3a8a|#000000").split("|"); return { background: `linear-gradient(135deg, ${a}, ${b})` }; }
    if (backdrop.type === "image") return { background: `url(${backdrop.value}) center/cover no-repeat` };
    return { background: "#000" };
  })();

  const onPointerDown = (key) => (e) => { e.preventDefault(); setDrag({ key, startX: e.clientX, startY: e.clientY, origX: liveLayout[key].x, origY: liveLayout[key].y }); };
  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const dx = ((e.clientX - drag.startX) / window.innerWidth) * 100;
      const dy = ((e.clientY - drag.startY) / window.innerHeight) * 100;
      setLiveLayout((p) => ({ ...p, [drag.key]: { ...p[drag.key], x: Math.max(0, Math.min(100, drag.origX + dx)), y: Math.max(0, Math.min(100, drag.origY + dy)) } }));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag]);

  if (blackout) {
    return (<div ref={viewerRef} style={{ height: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151" }}>
      <div style={{ textAlign: "center" }}><Power size={48} /><div style={{ marginTop: 10, letterSpacing: 4 }}>BLACKOUT</div><button onClick={onExit} style={{ marginTop: 20, ...btnStyle(theme) }}>Keluar</button></div>
    </div>);
  }
  const info = timer ? computeTimer(timer, now) : null;
  const L = liveLayout;
  return (
    <div ref={viewerRef} style={{ height: "100vh", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", animation: flashActive ? "stflash 0.4s infinite" : "none" }}>
      <style>{`@keyframes stflash { 0%,100%{background:#000} 50%{background:#fff} }`}</style>
      {/* Backdrop layer */}
      <div style={{ position: "absolute", inset: 0, ...backdropStyle, opacity: backdrop.opacity ?? 1, zIndex: 0 }} />
      {/* Bumpers */}
      {stage?.bumpers?.filter((b) => b.show).map((b) => (
        <div key={b.id} style={{ position: "absolute", left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}vw`, height: `${b.h}vh`, transform: "translate(-50%,-50%)", zIndex: 1 }}>
          {b.type === "video" ? (<video src={b.src} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />) : (<img src={b.src} alt={b.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />)}
        </div>
      ))}
      {/* Logo */}
      {stage?.logo && stage?.showLogo && (<img src={stage.logo} alt="logo" style={{ position: "absolute", left: `${L.logo.x}%`, top: `${L.logo.y}%`, width: `${L.logo.w}px`, transform: "translate(-50%,-50%)", zIndex: 2 }} />)}
      {/* Content layer */}
      <div style={{ position: "relative", zIndex: 3, width: "100%", height: "100%", pointerEvents: drag ? "none" : "auto" }}>
        {onAir && (<div style={{ position: "absolute", top: 24, right: 28, display: "flex", alignItems: "center", gap: 8, color: DANGER_COLOR, fontWeight: 800, fontSize: 22 }}><Circle size={16} fill={DANGER_COLOR} /> ON AIR</div>)}
        <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, ...btnStyle(theme) }}><X size={14} /> Keluar</button>
        <button onClick={onFullscreen} style={{ position: "absolute", top: 20, right: 20, ...btnStyle(theme) }}><Maximize2 size={14} /> Layar Penuh</button>
        {timer ? (<>
          <div onPointerDown={onPointerDown("title")} style={{ position: "absolute", left: `${L.title.x}%`, top: `${L.title.y}%`, transform: "translate(-50%,-50%)", fontSize: L.title.size, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.6)", cursor: "grab", userSelect: "none" }}>{timer.title}</div>
          <div onPointerDown={onPointerDown("timer")} style={{ position: "absolute", left: `${L.timer.x}%`, top: `${L.timer.y}%`, transform: "translate(-50%,-50%)", fontFamily: "monospace", fontWeight: 800, fontSize: L.timer.size, color: info.color, lineHeight: 1, textShadow: "0 2px 18px rgba(0,0,0,0.6)", cursor: "grab", userSelect: "none" }}>{info.display}</div>
          <div onPointerDown={onPointerDown("speaker")} style={{ position: "absolute", left: `${L.speaker.x}%`, top: `${L.speaker.y}%`, transform: "translate(-50%,-50%)", fontSize: L.speaker.size, color: "#e5e7eb", textShadow: "0 2px 12px rgba(0,0,0,0.6)", cursor: "grab", userSelect: "none" }}>{timer.speaker}</div>
          <svg onPointerDown={onPointerDown("progress")} width={`${L.progress.w}%`} height="14" style={{ position: "absolute", left: `${L.progress.x}%`, top: `${L.progress.y}%`, transform: "translate(-50%,-50%)", cursor: "grab" }}><rect width="100%" height="14" rx="7" fill="rgba(255,255,255,0.15)" /><rect width={`${info.frac * 100}%`} height="14" rx="7" fill={info.color} /></svg>
        </>) : (<div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", color: "#6b7280", fontSize: 24 }}>Tidak ada timer aktif</div>)}
        {messages.length > 0 && (<div onPointerDown={onPointerDown("messages")} style={{ position: "absolute", left: `${L.messages.x}%`, top: `${L.messages.y}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "90%", cursor: "grab" }}>
          {messages.map((m) => (<div key={m.id} style={{ background: m.color === "white" ? "rgba(255,255,255,0.95)" : MSG_COLORS[m.color].value, color: m.color === "white" ? "#111" : "#fff", padding: "14px 28px", borderRadius: 14, fontSize: m.upper ? 34 : 28, fontWeight: m.bold ? 800 : 600, textTransform: m.upper ? "uppercase" : "none", animation: m.flash ? "stflash 0.5s infinite" : "none", maxWidth: "90vw", textAlign: "center" }}>{m.text}</div>))}
        </div>)}
      </div>
    </div>
  );
}
