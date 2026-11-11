import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useState } from "react";

/** Load data once (and on demand), tracking loading and error state. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    loader()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(reload, [reload]);
  return { data, setData, error, loading, reload };
}

export function notifyError(e: unknown, title = "Something went wrong") {
  notifications.show({ color: "red", title, message: e instanceof Error ? e.message : String(e) });
}

export function notifyOk(message: string) {
  notifications.show({ color: "teal", message });
}

export const POLICY_COLORS = ["gray.6", "ledger.6", "orange.6", "grape.6", "red.6", "lime.7", "cyan.7", "pink.6", "yellow.7", "indigo.5"];
