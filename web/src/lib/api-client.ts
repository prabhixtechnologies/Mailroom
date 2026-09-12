import { z, ZodError } from "zod";
import { API_V1, MAILROOM_API_V1 } from "./config";

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string()).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export class ApiClientError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  readonly status: number;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = error.code;
    this.fieldErrors = error.fieldErrors;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipAuth?: boolean;
  skipOrg?: boolean;
  /** When true, call Mailroom (:8083 locally) instead of oneOps. */
  mailroom?: boolean;
}

let getAccessToken: () => string | null = () => null;
let getOrgId: () => string | null = () => null;
let refreshTokens: () => Promise<boolean> = async () => false;
let onUnauthorized: () => void = () => undefined;

export function configureApiClient(config: {
  getAccessToken: () => string | null;
  getOrgId: () => string | null;
  refreshTokens: () => Promise<boolean>;
  onUnauthorized: () => void;
}) {
  getAccessToken = config.getAccessToken;
  getOrgId = config.getOrgId;
  refreshTokens = config.refreshTokens;
  onUnauthorized = config.onUnauthorized;
}

function buildHeaders(options: RequestOptions, jsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  if (jsonBody) headers["Content-Type"] = "application/json";

  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Mail belongs to a mailbox, and a mailbox belongs to an organization. Somebody in two organizations
  // has two sets of mailboxes, so the header is as necessary here as it is in the consoles — the
  // backend validates membership on it and refuses anything else.
  if (!options.skipOrg) {
    const orgId = getOrgId();
    if (orgId) headers["X-Prabhix-Org"] = orgId;
  }

  return headers;
}

function parseSchema<T>(schema: { parse: (data: unknown) => T }, data: unknown, endpoint: string): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      // A response that is a 200 in the network tab but does not match its schema otherwise looks
      // exactly like an outage: an error screen with a retry button that can never succeed. Naming the
      // endpoint and the offending paths turns an afternoon of guessing into a glance at the console.
      console.error(
        `[api] ${endpoint} returned a response that does not match its schema:`,
        err.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
      );
      throw new ApiClientError(200, {
        code: "SCHEMA_MISMATCH",
        message: "Unexpected API response shape",
      });
    }
    throw err;
  }
}

async function parseError(response: Response): Promise<ApiClientError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) return new ApiClientError(response.status, parsed.data);
  } catch {
    // fall through to the generic message
  }
  return new ApiClientError(response.status, {
    code: "UNKNOWN",
    message: response.statusText || "Request failed",
  });
}

export async function apiRequest<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  options: RequestOptions = {},
): Promise<T> {
  const base = options.mailroom ? MAILROOM_API_V1 : API_V1;
  const url = path.startsWith("http") ? path : `${base}${path}`;

  const execute = async (retried: boolean): Promise<T> => {
    const hasJsonBody = options.body !== undefined;
    const response = await fetch(url, {
      method: options.method ?? (hasJsonBody ? "POST" : "GET"),
      headers: buildHeaders(options, hasJsonBody),
      body: hasJsonBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "include",
    });

    if (response.status === 401 && !retried && !options.skipAuth) {
      if (await refreshTokens()) return execute(true);
      onUnauthorized();
      throw new ApiClientError(401, { code: "UNAUTHORIZED", message: "Session expired" });
    }

    if (!response.ok) throw await parseError(response);

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return parseSchema(schema, null, path);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return parseSchema(schema, null, path);
    }

    const json: unknown = await response.json();
    return parseSchema(schema, json, path);
  };

  return execute(false);
}

export async function apiRequestVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await apiRequest(path, { parse: () => undefined }, options);
}

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const detail = Object.entries(err.fieldErrors ?? {})
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");
    return detail === "" ? err.message : `${err.message} (${detail})`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
