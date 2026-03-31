import {
  CheckCircle2,
  Eye,
  EyeOff,
  Link,
  Pause,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pomodoro-settings";

type Mode = "study" | "break" | "complete";

interface PomodoroSettings {
  studyDuration: number;
  breakDuration: number;
  totalSessions: number;
  themeColor: string;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  studyDuration: 90,
  breakDuration: 10,
  totalSessions: 7,
  themeColor: "#2EC4B6",
};

function hexToRgbA(hex: string, alpha: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function playBell() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 830;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2);
    setTimeout(() => ctx.close(), 3000);
  } catch {
    // Audio context may be unavailable
  }
}

function loadSettings(): PomodoroSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

function parseUrlParams(): Partial<PomodoroSettings> {
  const params = new URLSearchParams(window.location.search);
  const result: Partial<PomodoroSettings> = {};
  const study = params.get("study");
  const brk = params.get("break");
  const sessions = params.get("sessions");
  const color = params.get("color");
  if (study) result.studyDuration = Number.parseInt(study, 10);
  if (brk) result.breakDuration = Number.parseInt(brk, 10);
  if (sessions) result.totalSessions = Number.parseInt(sessions, 10);
  if (color) result.themeColor = color;
  return result;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildShareUrl(s: PomodoroSettings): string {
  const url = new URL(window.location.href.split("?")[0]);
  url.searchParams.set("study", String(s.studyDuration));
  url.searchParams.set("break", String(s.breakDuration));
  url.searchParams.set("sessions", String(s.totalSessions));
  url.searchParams.set("color", s.themeColor);
  return url.toString();
}

export default function App() {
  const urlParams = parseUrlParams();
  const storedSettings = loadSettings();
  const initialSettings: PomodoroSettings = { ...storedSettings, ...urlParams };

  const [settings, setSettings] = useState<PomodoroSettings>(initialSettings);
  const [draftSettings, setDraftSettings] =
    useState<PomodoroSettings>(initialSettings);
  const [mode, setMode] = useState<Mode>("study");
  const [currentSession, setCurrentSession] = useState(1);
  const [timeLeft, setTimeLeft] = useState(initialSettings.studyDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<Mode>(mode);
  const sessionRef = useRef(currentSession);
  const settingsRef = useRef(settings);

  modeRef.current = mode;
  sessionRef.current = currentSession;
  settingsRef.current = settings;

  useEffect(() => {
    if (transparent) {
      document.body.classList.add("transparent");
    } else {
      document.body.classList.remove("transparent");
    }
  }, [transparent]);

  const themeColor = settings.themeColor;
  useEffect(() => {
    document.documentElement.style.setProperty("--theme-color", themeColor);
  }, [themeColor]);

  const totalSeconds =
    mode === "study"
      ? settings.studyDuration * 60
      : settings.breakDuration * 60;

  const progress =
    totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          playBell();
          const curMode = modeRef.current;
          const curSession = sessionRef.current;
          const curSettings = settingsRef.current;
          if (curMode === "study") {
            setTimeout(() => {
              setMode("break");
              setTimeLeft(curSettings.breakDuration * 60);
              setAnimKey((k) => k + 1);
              setIsRunning(true);
            }, 100);
          } else if (curMode === "break") {
            const nextSession = curSession + 1;
            if (nextSession > curSettings.totalSessions) {
              setTimeout(() => {
                setMode("complete");
                setAnimKey((k) => k + 1);
                setIsRunning(false);
              }, 100);
            } else {
              setTimeout(() => {
                setCurrentSession(nextSession);
                setMode("study");
                setTimeLeft(curSettings.studyDuration * 60);
                setAnimKey((k) => k + 1);
                setIsRunning(true);
              }, 100);
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  function handleStart() {
    if (mode === "complete") return;
    setIsRunning(true);
  }

  function handlePause() {
    setIsRunning(false);
  }

  function handleReset() {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setMode("study");
    setCurrentSession(1);
    setTimeLeft(settings.studyDuration * 60);
    setAnimKey((k) => k + 1);
  }

  function handleApplySettings() {
    const valid: PomodoroSettings = {
      studyDuration: Math.max(1, draftSettings.studyDuration),
      breakDuration: Math.max(1, draftSettings.breakDuration),
      totalSessions: Math.max(1, draftSettings.totalSessions),
      themeColor: draftSettings.themeColor,
    };
    setSettings(valid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    window.history.replaceState({}, "", buildShareUrl(valid));
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setMode("study");
    setCurrentSession(1);
    setTimeLeft(valid.studyDuration * 60);
    setAnimKey((k) => k + 1);
    setShowSettings(false);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(buildShareUrl(settings)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleStartOver() {
    setMode("study");
    setCurrentSession(1);
    setTimeLeft(settings.studyDuration * 60);
    setIsRunning(false);
    setAnimKey((k) => k + 1);
  }

  const modeLabel =
    mode === "study" ? "STUDY" : mode === "break" ? "BREAK" : "COMPLETE";

  const glowStyle =
    mode === "study"
      ? `0 0 0 1px ${hexToRgbA(themeColor, 0.25)}, 0 0 50px ${hexToRgbA(themeColor, 0.1)}, 0 20px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4)`
      : `0 0 0 1px ${hexToRgbA(themeColor, 0.12)}, 0 0 30px ${hexToRgbA(themeColor, 0.05)}, 0 20px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4)`;

  return (
    <div className="flex items-center justify-center w-full min-h-screen p-4">
      <div
        style={{
          maxWidth: "680px",
          width: "92%",
          background: "linear-gradient(160deg, #2A2D33 0%, #24262C 100%)",
          border: `1px solid ${hexToRgbA(themeColor, 0.25)}`,
          borderRadius: "16px",
          padding: "clamp(32px, 6vw, 56px)",
          boxShadow: glowStyle,
          transition: "box-shadow 1s ease, border-color 0.5s ease",
        }}
      >
        {/* Top area: OBS toggle pinned top-right, STUDY/BREAK label centered */}
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setTransparent((t) => !t)}
            title={transparent ? "Show background" : "Transparent mode (OBS)"}
            style={{ position: "absolute", top: 0, right: 0 }}
            data-ocid="timer.toggle"
          >
            {transparent ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={`label-${animKey}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35 }}
              style={{
                textAlign: "center",
                color:
                  mode === "break" ? hexToRgbA(themeColor, 0.75) : themeColor,
                fontWeight: 700,
                fontSize: "2rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
              data-ocid="timer.section"
            >
              {modeLabel}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Main content area */}
        <AnimatePresence mode="wait">
          {mode === "complete" ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-5 py-8"
              data-ocid="timer.success_state"
            >
              <CheckCircle2
                size={72}
                style={{ color: themeColor }}
                strokeWidth={1.5}
              />
              <div
                style={{
                  color: "#E9E6D6",
                  fontWeight: 800,
                  fontSize: "2rem",
                  textAlign: "center",
                }}
              >
                All Done!
              </div>
              <div
                style={{
                  color: "#A7ABB3",
                  fontSize: "1rem",
                  textAlign: "center",
                }}
              >
                You completed {settings.totalSessions} sessions. Amazing work!
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartOver}
                style={{ background: themeColor, marginTop: "8px" }}
                data-ocid="timer.primary_button"
              >
                <RotateCcw size={15} />
                Start Over
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`timer-view-${animKey}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              {/* Timer digits */}
              <div
                className="timer-font text-center"
                style={{
                  color: "#E9E6D6",
                  marginTop: "6px",
                  marginBottom: "8px",
                }}
                data-ocid="timer.panel"
              >
                {formatTime(timeLeft)}
              </div>

              {/* Session counter */}
              <div
                className="text-center mb-5"
                style={{
                  color: "#D3D5DA",
                  fontWeight: 900,
                  fontSize: "1.75rem",
                  letterSpacing: "0.04em",
                }}
                data-ocid="timer.card"
              >
                Session {currentSession}/{settings.totalSessions}
              </div>

              {/* Progress bar */}
              <div className="progress-track mb-6">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {!isRunning ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleStart}
                    style={{ background: themeColor }}
                    data-ocid="timer.primary_button"
                  >
                    <Play size={14} fill="currentColor" />
                    Start
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={handlePause}
                    data-ocid="timer.secondary_button"
                  >
                    <Pause size={14} fill="currentColor" />
                    Pause
                  </button>
                )}

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleReset}
                  data-ocid="timer.delete_button"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowSettings((s) => !s)}
                  aria-expanded={showSettings}
                  data-ocid="timer.open_modal_button"
                >
                  <SettingsIcon size={13} />
                  Settings
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleCopyLink}
                  data-ocid="timer.button"
                >
                  <Link size={13} />
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Panel (collapsible) */}
        <div
          className={`settings-panel${showSettings ? " open" : ""}`}
          data-ocid="timer.panel"
        >
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              background: "#1E2128",
              borderRadius: "12px",
              border: "1px solid #2F3238",
            }}
          >
            <div
              style={{
                color: "#E9E6D6",
                fontWeight: 700,
                fontSize: "0.9rem",
                marginBottom: "16px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Settings
            </div>

            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "1fr 1fr" }}
            >
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="study-duration"
                  style={{
                    color: "#7E848E",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  Study (min)
                </label>
                <input
                  id="study-duration"
                  type="number"
                  className="settings-input"
                  min={1}
                  max={240}
                  value={draftSettings.studyDuration}
                  onChange={(e) =>
                    setDraftSettings((d) => ({
                      ...d,
                      studyDuration: Number.parseInt(e.target.value) || 1,
                    }))
                  }
                  data-ocid="timer.input"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="break-duration"
                  style={{
                    color: "#7E848E",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  Break (min)
                </label>
                <input
                  id="break-duration"
                  type="number"
                  className="settings-input"
                  min={1}
                  max={60}
                  value={draftSettings.breakDuration}
                  onChange={(e) =>
                    setDraftSettings((d) => ({
                      ...d,
                      breakDuration: Number.parseInt(e.target.value) || 1,
                    }))
                  }
                  data-ocid="timer.input"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="total-sessions"
                  style={{
                    color: "#7E848E",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  Total Sessions
                </label>
                <input
                  id="total-sessions"
                  type="number"
                  className="settings-input"
                  min={1}
                  max={20}
                  value={draftSettings.totalSessions}
                  onChange={(e) =>
                    setDraftSettings((d) => ({
                      ...d,
                      totalSessions: Number.parseInt(e.target.value) || 1,
                    }))
                  }
                  data-ocid="timer.input"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="theme-color"
                  style={{
                    color: "#7E848E",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  Theme Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="theme-color"
                    type="color"
                    value={draftSettings.themeColor}
                    onChange={(e) =>
                      setDraftSettings((d) => ({
                        ...d,
                        themeColor: e.target.value,
                      }))
                    }
                    style={{
                      width: "40px",
                      height: "38px",
                      border: "1.5px solid #3A3D44",
                      borderRadius: "6px",
                      background: "#1E2128",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                    data-ocid="timer.input"
                  />
                  <span
                    style={{
                      color: "#A7ABB3",
                      fontSize: "0.85rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {draftSettings.themeColor}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                className="btn-primary"
                onClick={handleApplySettings}
                style={{ background: themeColor }}
                data-ocid="timer.save_button"
              >
                Apply & Save
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setDraftSettings(settings);
                  setShowSettings(false);
                }}
                data-ocid="timer.cancel_button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
