// Minimal OpenAI-compatible chat client used by the persona test suite.
// No external dependencies; requires Node 18+ (global fetch).

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export function joinUrl(baseUrl, path) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const suffix = String(path || "").replace(/^\/+/, "");
  return `${base}/${suffix}`;
}

export async function listModels({ baseUrl, apiKey, timeoutMs = 30_000 }) {
  const response = await fetchWithTimeout(
    joinUrl(baseUrl, "models"),
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    timeoutMs,
  );

  if (!response.ok) {
    const body = await safeText(response);
    throw new ApiError(`GET /models failed with ${response.status}`, response.status, body);
  }

  const data = await response.json();
  const entries = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return entries
    .map((entry) => (typeof entry === "string" ? entry : entry?.id))
    .filter((id) => typeof id === "string");
}

export async function chatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.5,
  topP = 0.8,
  maxTokens,
  timeoutMs = 180_000,
  retries = 3,
  extraBody = {},
}) {
  if (!apiKey) throw new Error("No API key configured");
  if (!baseUrl) throw new Error("No base URL configured");
  if (!model) throw new Error("No model configured");
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("chatCompletion needs at least one message");
  }

  const body = {
    model,
    messages,
    temperature,
    top_p: topP,
    ...extraBody,
  };
  if (Number.isFinite(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        joinUrl(baseUrl, "chat/completions"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
      );

      if (!response.ok) {
        const text = await safeText(response);
        const error = new ApiError(
          `POST /chat/completions failed with ${response.status} (model ${model})`,
          response.status,
          text,
        );
        if (response.status >= 400 && response.status < 500 && !RETRYABLE_STATUS.has(response.status)) {
          throw error;
        }
        lastError = error;
      } else {
        const data = await response.json();
        const choice = data?.choices?.[0];
        const content = choice?.message?.content;
        if (typeof content !== "string" || content.length === 0) {
          const finishReason = choice?.finish_reason;
          throw new ApiError(
            `Model ${model} returned no text content (finish_reason: ${finishReason ?? "unknown"})`,
            502,
            JSON.stringify(data).slice(0, 1000),
          );
        }
        return {
          content,
          model: data?.model ?? model,
          usage: data?.usage ?? null,
          finishReason: choice?.finish_reason ?? null,
          reasoning: choice?.message?.reasoning ?? null,
        };
      }
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && !RETRYABLE_STATUS.has(error.status)) {
        throw error;
      }
    }

    if (attempt < retries) {
      const delay = Math.min(15_000, 1_500 * 2 ** attempt);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Chat completion failed");
}

export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(`Request timed out after ${timeoutMs} ms`, 408, "");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
