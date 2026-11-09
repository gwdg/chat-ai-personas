// LLM-as-judge evaluation for one persona test case.

import { chatCompletion } from "./client.mjs";

const MAX_SYSTEM_PROMPT_CHARS = 6_000;
const MAX_OUTPUT_CHARS = 12_000;

export function buildJudgeMessages({ persona, testCase, output, deterministic }) {
  const systemPrompt = persona.systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS
    ? `${persona.systemPrompt.slice(0, MAX_SYSTEM_PROMPT_CHARS)}\n\n[... persona system prompt truncated ...]`
    : persona.systemPrompt;

  const judgeSystem = `
You are an impartial, strict evaluator for automated persona tests.
You receive a persona definition, a user input, the model's output, a rubric,
and the results of deterministic checks.

Judge only whether the output works as the described persona for this input.
Use the rubric as the primary standard. Do not reward general eloquence and do
not add requirements that are not in the rubric or the persona's system prompt.
Fail the output when it breaks character, ignores an explicit rule, invents
facts or citations, uses the wrong language, refuses when it should answer, or
omits a required structural element.

Your reply must be one JSON object and nothing else:
{
  "pass": true,
  "score": 0,
  "reason": "short explanation",
  "violations": ["concrete violation, if any"]
}

Rules for the JSON:
- "pass" is a boolean.
- "score" is an integer from 0 to 100. 70 or more normally means pass.
- "reason" is one or two sentences.
- "violations" is an array of short strings; use [] when there are none.
- Do not use Markdown code fences.
`.trim();

  const deterministicText = deterministic.checks.length === 0
    ? "No deterministic checks."
    : deterministic.checks
        .map((check) => `- ${check.passed ? "PASS" : "FAIL"}: ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
        .join("\n");

  const user = `
PERSONA
Title: ${persona.title}
Subtitle: ${persona.subtitle || ""}

PERSONA SYSTEM PROMPT
<system_prompt>
${systemPrompt}
</system_prompt>

USER INPUT
<user_input>
${testCase.input}
</user_input>

MODEL OUTPUT
<model_output>
${output.slice(0, MAX_OUTPUT_CHARS)}
</model_output>

RUBRIC
<rubric>
${testCase.expect.rubric}
</rubric>

DETERMINISTIC CHECKS
<checks>
${deterministicText}
</checks>

Decide whether the model output satisfies the persona and the rubric.
Return only the JSON object described in your instructions.
`.trim();

  return [
    { role: "system", content: judgeSystem },
    { role: "user", content: user },
  ];
}

export async function judgeOutput({
  baseUrl,
  apiKey,
  model,
  persona,
  testCase,
  output,
  deterministic,
  timeoutMs,
  retries = 2,
}) {
  const messages = buildJudgeMessages({ persona, testCase, output, deterministic });

  const first = await chatCompletion({
    baseUrl,
    apiKey,
    model,
    messages,
    temperature: 0,
    topP: 0.2,
    maxTokens: 2_500,
    timeoutMs,
    retries,
  });

  const parsed = parseJudge(first.content);
  if (parsed) {
    return { ...parsed, raw: first.content, model: first.model, usage: first.usage };
  }

  const repairMessages = [
    ...messages,
    { role: "assistant", content: first.content },
    {
      role: "user",
      content:
        "Your previous reply was not valid JSON. Return only one JSON object with the keys pass, score, reason, and violations. No Markdown, no code fences, no additional text.",
    },
  ];

  const second = await chatCompletion({
    baseUrl,
    apiKey,
    model,
    messages: repairMessages,
    temperature: 0,
    topP: 0.2,
    maxTokens: 2_500,
    timeoutMs,
    retries,
  });

  const repaired = parseJudge(second.content);
  if (repaired) {
    return { ...repaired, raw: second.content, model: second.model, usage: second.usage, repaired: true };
  }

  throw new Error(`Judge returned invalid JSON twice. Last reply: ${second.content.slice(0, 500)}`);
}

export function parseJudge(text) {
  const candidate = extractJsonObject(text);
  if (!candidate) return null;

  let value;
  try {
    value = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (typeof value?.pass !== "boolean") return null;
  const score = Number(value.score);
  if (!Number.isFinite(score)) return null;

  return {
    pass: value.pass,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reason: typeof value.reason === "string" ? value.reason.trim() : "",
    violations: Array.isArray(value.violations)
      ? value.violations.filter((item) => typeof item === "string")
      : [],
  };
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = withoutFence.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return withoutFence.slice(start, index + 1);
    }
  }

  return null;
}
