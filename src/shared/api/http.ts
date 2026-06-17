export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

export async function http<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    let code = "REQUEST_FAILED";
    try {
      const body = await res.json();
      if (body?.error) code = String(body.error);
    } catch {
      // non-JSON error body — keep the default code
    }
    throw new HttpError(res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
