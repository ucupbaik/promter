import { useState, useRef, useEffect } from "react";
import { TimerIcon as Timer, LayoutIcon as Layout, SettingsIcon as Settings, CheckIcon as Check, XIcon as X } from "lucide-react";

const START_TIME = 25 * 60; // 25 minutes in seconds
const DEFAULT_COLOR = "#3b82f6";
const CUSTOM_COLORS = {
  blue: "#3b82f6",
  green: "#10b981",
  purple: "#8b5cf6",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
  yellow: "#eab308",
};

export default function App() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isSession, setIsSession] = useState(true);
  const [customColor, setCustomColor] = useState(DEFAULT_COLOR);
  const [customTitle, setCustomTitle] = useState("Stage Timer");
  const [showCustomization, setShowCustomization] = useState(false);
  const [alertShown, setAlertShown] = useState(false);
  const displayRef = useRef(null);

  const [theme, setTheme] = useState("light");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  useEffect(() => {
    const mq = prefersDark;
    const handleChange = () => {
      setTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const startTime = minutes * 60 + seconds;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timeoutId;

    if (isRunning && progress < 100) {
      timeoutId = setTimeout(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsRunning(false);
            setProgress(100);
            setAlertShown(true);
            return prev;
          }
          return prev + 1;
        });
      }, 60000 / (startTime > 0 ? startTime : 1));
    }

    return () => clearTimeout(timeoutId);
  }, [isRunning, progress, startTime]);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        if (seconds > 0) {
          setSeconds((prev) => prev - 1);
        } else if (minutes > 0) {
          setMinutes((prev) => prev - 1);
          setSeconds(59);
        } else {
          setIsRunning(false);
          clearInterval(interval);
          setAlertShown(true);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRunning, minutes, seconds]);

  useEffect(() => {
    const total = minutes * 60 + seconds;
    if (total > 0) {
      setProgress(((total - (minutes * 60 + seconds)) / total) * 100);
    }
  }, [minutes, seconds]);

  const formatTime = (m, s) =>
    `${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMinutes(25);
    setSeconds(0);
    setProgress(0);
  };

  const handleCustomize = () => {
    setShowCustomization(true);
  };

  const applyCustomization = () => {
    setCustomColor(document.getElementById("colorPicker")?.value || DEFAULT_COLOR);
    setCustomTitle(document.getElementById("titleInput")?.value || "Stage Timer");
    setShowCustomization(false);
  };

  const handleColorChange = (color) => {
    setCustomColor(color);
  };

  useEffect(() => {
    document.body.style.background = customColor;
    const root = document.documentElement;
    root.style.setProperty("--timer-color", customColor);
  }, [customColor]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: customColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: theme === "dark" ? "#fff" : "#000",
        fontFamily: "system-ui, -apple-system, sans-serif",
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      <nav style={{ width: "100%", padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "600", margin: 0, letterSpacing: "0.5px" }}>
          {customTitle}
        </h1>
        <button
          onClick={toggleTheme}
          style={{
            background: "none",
            border: "none",
            color: theme === "dark" ? "#fff" : "#000",
            fontSize: "0.875rem",
            cursor: "pointer",
            padding: "0.5rem",
          }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </nav>

      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              minHeight: "200px",
              background: theme === "dark" ? "#1e293b" : "#fff",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              transition: "background 0.3s ease",
            }}
          >
            <span
              style={{
                fontSize: "4rem",
                fontWeight: "bold",
                color: customColor,
              }}
            >
              {formatTime(minutes, seconds)}
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setMinutes((m) => Math.max(1, m - 1))}
              style={{
                width: "40px",
                height: "40px",
                border: "none",
                borderRadius: "8px",
                background: theme === "dark" ? "#334155" : "#f1f5f9",
                color: theme === "dark" ? "#fff" : "#000",
                fontSize: "1rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              -
            </button>
            <span style={{ width: "40px", textAlign: "center" }}>{minutes}</span>
            <button
              onClick={() => setMinutes((m) => m + 1)}
              style={{
                width: "40px",
                height: "40px",
                border: "none",
                borderRadius: "8px",
                background: theme === "dark" ? "#334155" : "#f1f5f9",
                color: theme === "dark" ? "#fff" : "#000",
                fontSize: "1rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setSeconds((s) => Math.max(0, s - 1))}
              style={{
                width: "40px",
                height: "40px",
                border: "none",
                borderRadius: "8px",
                background: theme === "dark" ? "#334155" : "#f1f5f9",
                color: theme === "dark" ? "#fff" : "#000",
                fontSize: "1rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              -
            </button>
            <span style={{ width: "40px", textAlign: "center" }}>{seconds}</span>
            <button
              onClick={() => setSeconds((s) => Math.min(59, s + 1))}
              style={{
                width: "40px",
                height: "40px",
                border: "none",
                borderRadius: "8px",
                background: theme === "dark" ? "#334155" : "#f1f5f9",
                color: theme === "dark" ? "#fff" : "#000",
                fontSize: "1rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>

          <div>
            <button
              onClick={isRunning ? handlePause : handleStart}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "none",
                borderRadius: "8px",
                background: isRunning ? "#ef4444" : "#3b82f6",
                color: "white",
                fontSize: "1rem",
                fontWeight: "500",
                cursor: "pointer",
                marginTop: "0.5rem",
                transition: "background 0.2s",
              }}
            >
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              onClick={handleReset}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "none",
                borderRadius: "8px",
                background: "#64748b",
                color: "white",
                fontSize: "1rem",
                fontWeight: "500",
                cursor: "pointer",
                marginTop: "0.5rem",
                transition: "background 0.2s",
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: "400px" }}>
          <button
            onClick={handleCustomize}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "none",
              borderRadius: "8px",
              background: customColor,
              color: "white",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: "pointer",
              marginTop: "1rem",
              transition: "background 0.2s",
            }}
          >
            Customize
          </button>
        </div>
      </main>

      {showCustomization && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: theme === "dark" ? "#1e293b" : "#fff",
              padding: "2rem",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "400px",
              color: theme === "dark" ? "#fff" : "#000",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "1.5rem", textAlign: "center" }}>
              Customize Timer
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Title
                <input
                  type="text"
                  id="titleInput"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Color
                <input
                  type="color"
                  id="colorPicker"
                  value={customColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  style={{
                    width: "100%",
                    height: "3rem",
                    padding: "0",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    appearance: "none",
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button
                onClick={applyCustomization}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  borderRadius: "8px",
                  background: customColor,
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Apply
              </button>
              <button
                onClick={() => setShowCustomization(false)}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  borderRadius: "8px",
                  background: "#64748b",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {alertShown && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              background: theme === "dark" ? "#1e293b" : "#fff",
              padding: "2rem",
              borderRadius: "12px",
              textAlign: "center",
              color: theme === "dark" ? "#fff" : "#000",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>
              {isSession ? "Time's up!" : "Session ended"}
            </h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Your timer has finished! {isSession ? "Start a new session." : "Good job!"}
            </p>
            <button
              onClick={handleReset}
              style={{
                padding: "0.75rem 1.5rem",
                border: "none",
                borderRadius: "8px",
                background: customColor,
                color: "white",
                fontSize: "1rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}