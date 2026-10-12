import "server-only";
import { z } from "zod";
import { ServiceError, parseRetryAfter, type FailureCode } from "./errors";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** A FormData body is sent as multipart (the runtime sets the boundary); anything else as JSON. */
  body?: unknown;
  token?: string;
  login?: boolean;
  unauthorizedAs?: FailureCode;
  /**
   * Authenticated API calls: 401 -> unauthenticated, 403 -> forbidden, 404 -> not-found,
   * 409 -> conflict. Unset keeps the login-oriented mapping used by the auth gateway.
   */
  authenticated?: boolean;
  /**
   * Refines a 403 using the backend `detail` (string or object). The text is never surfaced to users.
   * Return undefined for anything unexpected: the call then falls back to the plain `forbidden`.
   */
  classifyForbidden?: (detail: unknown) => FailureCode | undefined;
  /** Per-call overrides of the status mapping (applied before the defaults). */
  statusMap?: Partial<Record<number, FailureCode>>;
  /** Refines a 409 using the backend `detail` text. The text is never surfaced to users. */
  classifyConflict?: (detail: string) => FailureCode | undefined;
  /**
   * Parses a structured (non-string) 409 `detail`, e.g. an object with extra context.
   * Return undefined for anything unexpected: the call then falls back to the generic conflict.
   */
  parseConflict?: (detail: unknown) => ServiceError | undefined;
  /**
   * Parses the Pydantic 422 `detail` array (never surfaced to users). Return undefined for anything
   * unexpected: the call then falls back to the generic `validation` failure.
   */
  parse422?: (detail: unknown) => ServiceError | undefined;
};

/** The backend `detail` as-is: a string for most errors, an object for structured ones. */
async function readRawDetail(response: Response): Promise<unknown> {
  try {
    const payload: unknown = await response.json();
    return (payload as { detail?: unknown } | null)?.detail;
  } catch { return undefined; }
}

export function createJsonClient(baseUrl: string, fetcher: typeof fetch = fetch, timeoutMs = 8000) {
  return async function request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const multipart = options.body instanceof FormData;
      if (options.body !== undefined && !multipart) headers["Content-Type"] = "application/json";
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      const response = await fetcher(`${baseUrl}${path}`, {
        method: options.method ?? "GET", headers,
        body: options.body === undefined ? undefined : multipart ? (options.body as FormData) : JSON.stringify(options.body),
        cache: "no-store", redirect: "error", signal: controller.signal,
      });
      if (!response.ok) {
        const mapped = options.statusMap?.[response.status];
        if (mapped) throw new ServiceError(mapped);
        if (options.authenticated) {
          if (response.status === 401) throw new ServiceError("unauthenticated");
          if (response.status === 403) {
            const refined = options.classifyForbidden ? options.classifyForbidden(await readRawDetail(response)) : undefined;
            throw new ServiceError(refined ?? "forbidden");
          }
          if (response.status === 404) throw new ServiceError("not-found");
          if (response.status === 409) {
            const raw = options.classifyConflict || options.parseConflict ? await readRawDetail(response) : undefined;
            const structured = options.parseConflict?.(raw);
            if (structured) throw structured;
            const refined = options.classifyConflict?.(typeof raw === "string" ? raw : "");
            throw new ServiceError(refined ?? "conflict");
          }
        } else if (response.status === 401 || response.status === 403) {
          throw new ServiceError(options.unauthorizedAs ?? (options.login ? "credentials" : "unauthenticated"));
        }
        if (response.status === 422 && options.parse422) {
          const structured = options.parse422(await readRawDetail(response));
          if (structured) throw structured;
        }
        if (response.status === 400 || response.status === 422) throw new ServiceError("validation");
        // Never retried here: the caller shows how long to wait and the user decides.
        if (response.status === 429) throw new ServiceError("rate-limit", { retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")) });
        throw new ServiceError("upstream");
      }
      let payload: unknown;
      if (response.status === 204) payload = undefined;
      else {
        try { payload = await response.json(); }
        catch { throw new ServiceError(controller.signal.aborted ? "timeout" : "malformed"); }
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new ServiceError("malformed");
      return parsed.data;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(controller.signal.aborted ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Bearer-authenticated client bound to one session token (used by feature gateways). */
export function createAuthenticatedClient(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs?: number) {
  const request = createJsonClient(baseUrl, fetcher, timeoutMs);
  return <T>(path: string, schema: z.ZodType<T>, options: Omit<RequestOptions, "token" | "authenticated"> = {}) =>
    request(path, schema, { ...options, token, authenticated: true });
}
