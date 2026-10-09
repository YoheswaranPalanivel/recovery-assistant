import type {
  AuditEntry,
  Insight,
  IngestionBatch,
  IngestionStatus,
  LlmContext,
  MessageType,
  Overview,
  PipelineStatus,
  SessionUser,
  UserSummary,
  TodayView,
  CarePlan,
  ActionKind,
  ContactAction,
  MemberDetail,
  MemberWeek,
  CommunityView,
  CommunitySummary,
  MemberApp,
  CheckIn
} from "@shared/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Filters = { userId?: string; from?: string; to?: string };
export type Status = { llm: boolean; model: string | null; records: number; targetSteps: number };

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

/** Called when any request comes back 401, so the app can send the user to sign in. */
let onUnauthorised: (() => void) | null = null;
export const setUnauthorisedHandler = (fn: () => void) => {
  onUnauthorised = fn;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // credentials: include sends the httpOnly session cookie; JS never sees the token.
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", credentials: "include", ...init });
  } catch {
    throw new ApiError(`Can't reach the backend at ${API_URL}. Start it with "npm run dev" in the backend folder.`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/")) onUnauthorised?.();
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

const qs = (f: Filters) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  login: (username: string, password: string) => request<{ user: SessionUser }>("/api/auth/login", json({ username, password })),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: SessionUser }>("/api/auth/me"),

  status: () => request<Status>("/api/status"),
  today: () => request<TodayView>("/api/today"),
  plan: (userId: string) => request<CarePlan>("/api/plan", json({ userId })),
  members: () => request<MemberWeek[]>("/api/members"),
  memberApp: (userId: string) => request<MemberApp>(`/api/member-app/${encodeURIComponent(userId)}`),
  checkIn: (b: { userId: string; mood: CheckIn["mood"]; medicineTaken: boolean | null }) => request<CheckIn>("/api/checkins", json(b)),
  community: () => request<CommunityView>("/api/community"),
  communitySummary: () => request<CommunitySummary>("/api/community/summary", { method: "POST" }),
  member: (userId: string) => request<MemberDetail>(`/api/members/${encodeURIComponent(userId)}`),
  recordAction: (b: { userId: string; kind: ActionKind; note?: string; followUpDays: number | null }) =>
  request<ContactAction>("/api/actions", json(b)),
  overview: (f: Filters) => request<Overview>(`/api/overview${qs(f)}`),
  users: () => request<UserSummary[]>("/api/users"),
  ingestion: () => request<IngestionStatus>("/api/ingestion"),
  pipeline: () => request<PipelineStatus>("/api/pipeline"),
  audit: () => request<AuditEntry[]>("/api/audit"),

  context: (f: Filters) => request<LlmContext>(`/api/insights/context${qs(f)}`),
  insights: (userId: string) => request<Insight[]>(`/api/insights${qs({ userId })}`),
  generate: (f: Filters & { messageType?: MessageType }) => request<Insight>("/api/insights", json(f)),

  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<{ batches: IngestionBatch[] }>("/api/upload", { method: "POST", body: form });
  },
  loadDemo: () => request<{ batches: IngestionBatch[]; dataset: string }>("/api/demo/load", { method: "POST" }),
  reset: () => request<{ ok: true }>("/api/reset", { method: "POST" }),
};
