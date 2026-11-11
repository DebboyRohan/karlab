import type {
  CalibrationRow,
  Economy,
  EconomySummary,
  IncomeTax,
  Meta,
  Mode,
  Policy,
  PopulationSet,
  Run,
  RunRequest,
  RunSummary,
  SchedulePoint,
  SetPreview,
} from "./types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail))
        message = data.detail.map((d: { loc: string[]; msg: string }) => `${d.loc.slice(1).join(" → ")}: ${d.msg}`).join("; ");
    } catch {
      /* keep the status text */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => request<Meta>("GET", "/meta"),

  economies: () => request<EconomySummary[]>("GET", "/economies"),
  economy: (id: string) => request<Economy>("GET", `/economies/${id}`),
  createEconomy: (e: Economy) => request<Economy>("POST", "/economies", e),
  saveEconomy: (e: Economy) => request<Economy>("PUT", `/economies/${e.id}`, e),
  duplicateEconomy: (id: string) => request<Economy>("POST", `/economies/${id}/duplicate`),
  deleteEconomy: (id: string) => request<unknown>("DELETE", `/economies/${id}`),
  calibration: (id: string, policy_id: string, mode: Mode = "M2") =>
    request<CalibrationRow[]>("POST", `/economies/${id}/calibration`, { policy_id, mode }),
  previewSet: (set: PopulationSet) => request<SetPreview>("POST", "/population/preview", { set }),

  policies: () => request<Policy[]>("GET", "/policies"),
  policy: (id: string) => request<Policy>("GET", `/policies/${id}`),
  createPolicy: (p: Policy) => request<Policy>("POST", "/policies", p),
  savePolicy: (p: Policy) => request<Policy>("PUT", `/policies/${p.id}`, p),
  duplicatePolicy: (id: string) => request<Policy>("POST", `/policies/${id}/duplicate`),
  deletePolicy: (id: string) => request<unknown>("DELETE", `/policies/${id}`),
  schedulePreview: (income_tax: IncomeTax) =>
    request<SchedulePoint[]>("POST", "/policies/schedule-preview", { income_tax }),

  linearOptimum: (economy_id: string, inequality_aversion: number) =>
    request<Policy>("POST", "/theory/linear-optimum", { economy_id, inequality_aversion }),
  saezTopRate: (economy_id: string, policy_id: string, inequality_aversion: number) =>
    request<Policy>("POST", "/theory/saez-top-rate", { economy_id, policy_id, inequality_aversion }),

  runs: () => request<RunSummary[]>("GET", "/runs"),
  run: (id: string) => request<Run>("GET", `/runs/${id}`),
  createRun: (r: RunRequest) => request<Run>("POST", "/runs", r),
  deleteRun: (id: string) => request<unknown>("DELETE", `/runs/${id}`),
};
