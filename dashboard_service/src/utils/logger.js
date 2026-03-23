/**
 * Small namespaced logger for the barricade dashboard (browser console).
 * Set localStorage BARRICADE_LOG_LEVEL = "debug" | "info" | "warn" | "error" | "silent"
 */
const NS = "[barricade]";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 99 };

function currentLevel() {
  try {
    const v = (localStorage.getItem("BARRICADE_LOG_LEVEL") || "info").toLowerCase();
    return LEVELS[v] !== undefined ? v : "info";
  } catch {
    return "info";
  }
}

function shouldLog(level) {
  const cur = LEVELS[currentLevel()] ?? LEVELS.info;
  return LEVELS[level] >= cur;
}

export const logger = {
  debug: (...args) => {
    if (shouldLog("debug")) console.debug(NS, ...args);
  },
  info: (...args) => {
    if (shouldLog("info")) console.info(NS, ...args);
  },
  warn: (...args) => {
    if (shouldLog("warn")) console.warn(NS, ...args);
  },
  error: (...args) => {
    if (shouldLog("error")) console.error(NS, ...args);
  },
};
