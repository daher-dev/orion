import { isDevBypassEnabled } from "@/lib/firebase";

/**
 * Thin fetch wrapper for the Orion backend.
 *
 * Design notes
 * - This module intentionally has no React imports — it accepts auth and
 *   tenant context as plain arguments. The hooks layer (useApi) wires the
 *   contexts in. This keeps the client testable in plain Node and avoids
 *   accidental React tree dependencies.
 * - In dev-bypass mode it sends the X-Dev-Bypass-* headers; otherwise it
 *   sends Authorization: Bearer <idToken>.
 * - Error envelopes from the backend take the shape
 *   { detail: string, validation_errors?: ... }. We coerce to a typed
 *   ApiError so callers don't need to remember the snake_case key.
 */

export type ApiClientOptions = {
  baseUrl?: string;
  /** Async or sync token getter (Firebase id token). */
  getIdToken?: () => Promise<string | null> | string | null;
  /** Currently selected tenant — sent as X-Orion-Company-Id when set. */
  companyId?: string | null;
  /** Dev-bypass UID/name/email — only consulted when isDevBypassEnabled is true. */
  devBypass?: {
    uid: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

export type ValidationErrors = Record<string, string[]> | unknown;

export class ApiError extends Error {
  status: number;
  detail: string;
  validationErrors?: ValidationErrors;

  constructor(status: number, detail: string, validationErrors?: ValidationErrors) {
    super(detail || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.validationErrors = validationErrors;
  }
}

export type RequestOptions = {
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function buildHeaders(
  options: ApiClientOptions,
  init: RequestOptions = {},
  hasBody = false,
): Promise<Headers> {
  const headers = new Headers(init.headers ?? {});
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  if (isDevBypassEnabled) {
    // In dev-bypass mode the X-Dev-Bypass-* headers are the only auth.
    // Prefer the explicit devBypass option (carries name + email for the
    // synthesized user), but fall back to the env-baked uid so requests
    // fired before the AuthProvider has populated `user` still authenticate.
    const uid = options.devBypass?.uid ?? process.env.NEXT_PUBLIC_DEV_BYPASS_UID;
    if (uid) {
      headers.set("X-Dev-Bypass-Uid", uid);
      if (options.devBypass?.name) headers.set("X-Dev-Bypass-Name", options.devBypass.name);
      if (options.devBypass?.email) headers.set("X-Dev-Bypass-Email", options.devBypass.email);
    }
  } else if (options.getIdToken) {
    const token = await options.getIdToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.companyId) headers.set("X-Orion-Company-Id", options.companyId);

  return headers;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = response.statusText || "Request failed";
  let validationErrors: ValidationErrors | undefined;
  try {
    const data = (await response.json()) as { detail?: unknown; validation_errors?: ValidationErrors };
    if (typeof data.detail === "string") detail = data.detail;
    else if (data.detail !== undefined) detail = JSON.stringify(data.detail);
    if (data.validation_errors !== undefined) validationErrors = data.validation_errors;
  } catch {
    // Non-JSON body — keep the default detail.
  }
  return new ApiError(response.status, detail, validationErrors);
}

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  options: ApiClientOptions,
  reqOptions: RequestOptions = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const url = buildUrl(baseUrl, path, reqOptions.query);
  const hasBody = body !== undefined && body !== null;
  const headers = await buildHeaders(options, reqOptions, hasBody);
  const response = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal: reqOptions.signal,
    credentials: "omit",
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  // Tolerate empty 200 bodies.
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Build a bound API client given the current auth + tenant context. */
export function createApiClient(options: ApiClientOptions) {
  return {
    get: <T>(path: string, reqOptions?: RequestOptions) =>
      request<T>("GET", path, undefined, options, reqOptions),
    post: <T>(path: string, body?: unknown, reqOptions?: RequestOptions) =>
      request<T>("POST", path, body, options, reqOptions),
    patch: <T>(path: string, body?: unknown, reqOptions?: RequestOptions) =>
      request<T>("PATCH", path, body, options, reqOptions),
    put: <T>(path: string, body?: unknown, reqOptions?: RequestOptions) =>
      request<T>("PUT", path, body, options, reqOptions),
    delete: <T>(path: string, reqOptions?: RequestOptions) =>
      request<T>("DELETE", path, undefined, options, reqOptions),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Convenience standalone helpers — useful in tests and one-off scripts. */
export const apiGet = <T>(path: string, options: ApiClientOptions, reqOptions?: RequestOptions) =>
  request<T>("GET", path, undefined, options, reqOptions);
export const apiPost = <T>(
  path: string,
  body: unknown,
  options: ApiClientOptions,
  reqOptions?: RequestOptions,
) => request<T>("POST", path, body, options, reqOptions);
export const apiPatch = <T>(
  path: string,
  body: unknown,
  options: ApiClientOptions,
  reqOptions?: RequestOptions,
) => request<T>("PATCH", path, body, options, reqOptions);
export const apiDelete = <T>(path: string, options: ApiClientOptions, reqOptions?: RequestOptions) =>
  request<T>("DELETE", path, undefined, options, reqOptions);
