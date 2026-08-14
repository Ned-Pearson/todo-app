import { useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateCheckState {
  available: Update | null;
  installing: boolean;
  error: string | null;
  install: () => void;
  dismiss: () => void;
  checking: boolean;
  checkError: string | null;
  upToDate: boolean;
  checkNow: () => void;
}

// Fires once per session, the moment auto-check is (or becomes) enabled —
// tied to the toggle turning on rather than a literal "on mount" only, so
// switching it on in Settings checks right away instead of requiring a
// restart to take effect. `hasChecked` stops it from re-firing on every
// later render once a check has already happened this session.
export function useUpdateCheck(autoCheckEnabled: boolean): UpdateCheckState {
  const [available, setAvailable] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [upToDate, setUpToDate] = useState(false);
  const hasChecked = useRef(false);
  const upToDateTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!autoCheckEnabled || hasChecked.current) return;
    hasChecked.current = true;
    check()
      .then((update) => {
        if (update) setAvailable(update);
      })
      .catch((err) => {
        // Silent — a failed background check (offline, no release
        // published yet, endpoint unreachable) shouldn't interrupt
        // startup with an error nobody asked to see.
        console.error("Update check failed:", err);
      });
  }, [autoCheckEnabled]);

  // The "Check for updates now" button's own trigger — deliberately doesn't
  // read or depend on autoCheckEnabled, since the whole point of a manual
  // button is to still work with auto-check switched off.
  const checkNow = () => {
    if (checking) return;
    setChecking(true);
    setCheckError(null);
    setUpToDate(false);
    if (upToDateTimeout.current != null) {
      window.clearTimeout(upToDateTimeout.current);
      upToDateTimeout.current = null;
    }
    check()
      .then((update) => {
        if (update) {
          setAvailable(update);
        } else {
          // Transient rather than persistent: nothing to keep showing once
          // the person has seen it, and leaving it up would look like a
          // stale claim of being up to date after they later become not.
          setUpToDate(true);
          upToDateTimeout.current = window.setTimeout(() => setUpToDate(false), 4000);
        }
      })
      .catch((err) => {
        setCheckError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    return () => {
      if (upToDateTimeout.current != null) window.clearTimeout(upToDateTimeout.current);
    };
  }, []);

  const install = () => {
    if (!available) return;
    setInstalling(true);
    setError(null);
    available
      .downloadAndInstall()
      .then(() => relaunch())
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setInstalling(false);
      });
  };

  const dismiss = () => setAvailable(null);

  return { available, installing, error, install, dismiss, checking, checkError, upToDate, checkNow };
}
