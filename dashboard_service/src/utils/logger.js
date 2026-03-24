/**
 * Small namespaced logger for the barricade dashboard (browser console).
 * Set localStorage BARRICADE_LOG_LEVEL = "debug" | "info" | "warn" | "error" | "silent"
 * Prefix is styled yellow for quick scanning alongside Python services in demos.
 */
const NS = "[dashboard]";
// Yellow (barricade dashboard_service); remaining arguments use default console styling
const DASH_LOG_STYLE = "color: #ca8a04; font-weight: 600;";

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
    if (shouldLog("debug")) console.debug(`%c${NS}`, DASH_LOG_STYLE, ...args);
  },
  info: (...args) => {
    if (shouldLog("info")) console.info(`%c${NS}`, DASH_LOG_STYLE, ...args);
  },
  warn: (...args) => {
    if (shouldLog("warn")) console.warn(`%c${NS}`, DASH_LOG_STYLE, ...args);
  },
  error: (...args) => {
    if (shouldLog("error")) console.error(`%c${NS}`, DASH_LOG_STYLE, ...args);
  },
};
