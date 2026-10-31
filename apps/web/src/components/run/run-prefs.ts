"use client";
import { useCallback, useEffect, useState } from "react";

const PREFIX = "simulization.run.";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* private mode or blocked storage: the preference just does not persist */
  }
}

/**
 * Boolean preference remembered in localStorage. Renders `fallback` on the server and first client
 * pass (no hydration mismatch), then adopts the stored value. `ready` is false until that happens.
 */
export function useStoredFlag(key: string, fallback: boolean): { value: boolean; ready: boolean; set: (v: boolean) => void } {
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const stored = read(key);
    // Deferred so the adopt-stored-value pass is not a synchronous cascading render.
    const t = setTimeout(() => {
      if (stored === "1") setValue(true);
      else if (stored === "0") setValue(false);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [key]);
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      write(key, v ? "1" : "0");
    },
    [key],
  );
  return { value, ready, set };
}
