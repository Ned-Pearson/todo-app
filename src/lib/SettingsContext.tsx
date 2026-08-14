import { createContext, useContext, type ReactNode } from "react";
import type { Theme } from "./appConstants";

export interface SettingsContextValue {
  theme: Theme;
  setTheme: (updater: (t: Theme) => Theme) => void;
  customAccent: string | null;
  setCustomAccent: (color: string | null) => void;
  dndEnabled: boolean;
  setDndEnabled: (enabled: boolean) => void;
  notifySnoozeMinutes: number;
  setNotifySnoozeMinutes: (minutes: number) => void;
  weekStartsOn: 0 | 1;
  setWeekStartsOn: (value: 0 | 1) => void;
  trashRetentionDays: number;
  setTrashRetentionDays: (days: number) => void;
  autoUpdateCheckEnabled: boolean;
  setAutoUpdateCheckEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// App.tsx still owns the actual useState calls and their localStorage
// persistence effects — this only replaces how theme/accent/notifications/
// week-start/trash-retention get from there down to Sidebar and
// CalendarView, the two components that read them, instead of each value
// (and setter) being threaded through as its own individual prop.
export function SettingsProvider({ value, children }: { value: SettingsContextValue; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// Every consumer of this lives inside App's <SettingsProvider> — there's no
// meaningful standalone case to support, so this throws instead of making
// every call site null-check a value that's always actually there.
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
