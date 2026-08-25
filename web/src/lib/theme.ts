import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "todos-theme";

const listeners = new Set<() => void>();

function readStored(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeMode {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let current: ThemeMode = "light";

function apply(mode: ThemeMode) {
  current = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
  for (const listener of listeners) listener();
}

/** 於 app 啟動時呼叫一次：優先採用使用者存過的偏好，否則跟隨系統 */
export function initTheme() {
  apply(readStored() ?? systemTheme());
}

export function toggleTheme() {
  const next: ThemeMode = current === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 隱私模式下寫不進去也不影響切換
  }
  apply(next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeMode {
  return current;
}

export function useTheme() {
  const resolvedTheme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { resolvedTheme, toggleTheme };
}
