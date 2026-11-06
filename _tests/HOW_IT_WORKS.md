# How the persona test suite works

This document explains the internals of the LLM-as-judge test suite in this
directory. For installation and quick commands, see [README.md](README.md).

## Purpose

The suite answers one question for every persona in the repository:

> Given a realistic input, does the persona behave the way its system prompt and
> its test rubric say it should?

It is a prompt-quality and regression test, not a UI test. It does not run
Chat AI, import personas, or exercise Arcana retrieval. It calls an
OpenAI-compatible chat endpoint directly with the persona's system prompt.

A case passes only when both layers agree:

1. **deterministic checks** on the raw output, and
2. an **LLM judge** that reads the persona, input, output, and rubric.

## Components

| File | Responsibility |
|---|---|
| `_tests/cases.mjs` | One or more cases per persona: input, deterministic expectations, judge rubric |
| `_tests/run.mjs` | CLI, persona discovery, validation, execution, scoring, reports |
| `_tests/client.mjs` | Minimal OpenAI-compatible client: `/models`, `/chat/completions`, retries, timeouts |
| `_tests/judge.mjs` | Judge prompt, JSON extraction, repair retry |
| `_tests/report.json` | Machine-readable run report (generated, gitignored) |
| `_tests/report.md` | Human-readable run report (generated, gitignored) |
| `_tests/README.md` | Usage and options |
| `_tests/HOW_IT_WORKS.md` | This document |

No npm dependencies are required. The suite uses Node's built-in `fetch` and
requires Node 18 or newer.

## End-to-end flow

```
CLI args + env + optional config file
                 │
                 ▼
        resolveSettings()
                 │
                 ▼
        loadEverything()
        ├─ loadPersonas()       walk repo, parse persona JSON
        ├─ validate cases       ids, personas, regexes, formats
        ├─ apply filters        --persona, --case
        └─ coverage check       every persona needs a case
                 │
                 ▼
        runSuite()
        ├─ listModels()         optional availability check
        ├─ worker pool          N cases in parallel
        │   └─ runCase()
        │       ├─ chatCompletion(persona)   system + input
        │       ├─ checkExpectations()       deterministic checks
        │       ├─ judgeOutput()             judge model
        │       └─ pass = deterministic && judge.pass
        └─ summarize()
                 │
                 ▼
        console + report.json + report.md
```

## 1. Settings and configuration

`resolveSettings()` (`_tests/run.mjs`) resolves values in this order:

1. CLI flags,
2. environment variables,
3. an optional `--config` JSON file,
4. built-in defaults.

The config file is intended for an existing Chat AI `back.json`:

```json
{
  "apiEndpoint": "https://chat-ai.academiccloud.de/v1",
  "apiKey": "..."
}
```

The API key is never printed and never written to a report. If no key is
configured, the runner exits with an explanatory message.

Important defaults:

| Setting | Default |
|---|---|
| Base URL | `https://chat-ai.academiccloud.de/v1` |
| Judge model | `deepseek-v4.1-flash-1017` |
| Fallback model | `deepseek-v4.1-flash-1017` |
| Persona `max_tokens` | `8000` |
| Judge `max_tokens` | `2500` |
| Timeout | `180000` ms per request |
| Concurrency | `3` |

## 2. Persona discovery

`loadPersonas()` (`_tests/run.mjs`) recursively walks the repository and skips
`.git`, `.github`, `node_modules`, `tests`, `dist`, `build`, `bin`, `obj`, and
other generated directories.

A JSON file counts as a persona when it has:

- a non-empty `messages` array,
- at least one `system` message with content.

A missing `title` is not fatal: the filename is used in reports. `package.json`
and `package-lock.json` are ignored. Other JSON files without a `messages` array
are silently skipped.

For generation, the runner concatenates all `system` messages into one system
prompt. `info` messages are user-visible only and are **not** sent to the model.

The loader also records `model`, `model-name`, `temperature`, `top_p`, and the
optional `arcana` block for reporting.

## 3. Case loading and validation

Cases live in `_tests/cases.mjs` and are exported as an array. Every case is
validated before any API call:

- `id` must be present and unique,
- `persona` must point to a discovered persona,
- `input` and `expect.rubric` must be present,
- regex patterns must compile,
- `format` must be one of `text`, `markdown`, `json`, `svg`,
- `minChars` / `maxChars` must be numbers.

With no filters, the runner also fails when a persona has no case. This keeps
the suite honest as new personas are added. Use `--allow-uncovered` to bypass
that check, or use `--persona` / `--case` filters, which disable the coverage
check for the filtered run.

## 4. Case schema

Each case has this shape:

```js
{
  id: "email-writer-bullets",
  persona: "writing/email-writer.json",
  name: "Email from bullet points",
  input: "- The last meeting went well\n- ...",
  model: "optional-model-override",
  judgeModel: "optional-judge-override",
  temperature: 0.4,
  topP: 0.8,
  expect: {
    mustInclude: ["..."],          // every string must appear
    mustIncludeAny: ["a", "b"],    // one of these must appear
    mustIncludeAnyGroups: [        // each group needs one match, all groups must match
      ["a", "b"],
      ["c"],
    ],
    mustNotInclude: ["..."],       // none may appear
    mustMatch: ["regex"],          // every regex must match
    mustNotMatch: ["regex"],       // no regex may match
    minChars: 10,
    maxChars: 2000,
    format: "markdown",
    rubric: "What the judge should verify.",
  },
}
```

### String checks

- `mustInclude`, `mustIncludeAny`, `mustNotInclude`, and each group in
  `mustIncludeAnyGroups` are **case-insensitive substring** checks.
- `mustIncludeAnyGroups` exists because a case often needs several independent
  “one of these” groups. For example, can show that an answer names a topic
  **and** a deadline **and** an action, while allowing synonyms for each.

### Regex checks

JS `RegExp` does not support inline flags such as `(?i)`. `compileRegex()`
(`_tests/run.mjs`) reads a leading inline flag group (`(?i)`, `(?m)`, `(?im)`,
etc.) and converts it into real regex flags, then compiles the rest.

So this is valid in a case:

```js
mustMatch: ["(?im)^subject:"]
```

### Format checks

| Format | Check |
|---|---|
| `text` | non-empty after trimming |
| `markdown` | at least one Markdown heading or list item |
| `json` | a parseable JSON object/array, tolerating code fences and surrounding text |
| `svg` | contains `<svg ...>` and `</svg>` |

All deterministic checks are ANDed. One failed check fails the deterministic
layer.

## 5. Per-case execution

`runCase()` (`_tests/run.mjs`) does the following:

1. Resolve the effective model (see below).
2. Build the request:

   ```js
   messages = [
     { role: "system", content: persona.systemPrompt },
     { role: "user",   content: testCase.input },
   ]
   ```

3. Call `chatCompletion()` with the persona's `temperature` and `top_p`
   (case override, then persona value, then defaults `0.5` / `0.8`).
4. Store the output and token usage.
5. Run `checkExpectations()`.
6. Unless `--no-judge` is set, run `judgeOutput()`.
7. Set `passed = deterministic.passed && judge.pass`.
8. Classify the result as `pass`, `fail`, `error`, or `skipped`.

An API failure, timeout, or empty completion becomes an `error`, not a silent
failure. Errors are counted separately from rubric failures.

## 6. Deterministic checks

`checkExpectations()` (`_tests/run.mjs`) builds a list of named checks, for
example:

- `must include "Acme Robotics"` — passed
- `must include one of: Friday / next Wednesday` — passed
- `must not include "As an AI"` — passed
- `must match /(?m)^## Tasks/` — failed
- `length <= 3000` — passed
- `format: markdown` — passed

The full list is stored in the report. This makes failures explainable without
re-reading the judge output.

## 7. The judge

`judgeOutput()` (`_tests/judge.mjs`) sends a second chat request. The judge sees:

- persona title, subtitle, and a truncated system prompt,
- the user input,
- the model output,
- the rubric,
- the deterministic check results.

The judge is instructed to:

- judge against the rubric and the persona, not general eloquence,
- fail persona breaks, ignored explicit rules, invented facts or citations,
  wrong language, unnecessary refusals, and missing structural elements,
- return only JSON:

```json
{
  "pass": true,
  "score": 92,
  "reason": "Short explanation.",
  "violations": []
}
```

`parseJudge()` extracts the JSON object even if the model wraps it in a code
fence or adds text. If parsing fails, the judge is called once more with a
repair instruction. If it fails twice, the case becomes an `error`.

The judge uses `temperature: 0`, `top_p: 0.2`, and a larger token budget because
reasoning models spend completion tokens on internal reasoning.

### Why both layers?

The deterministic layer catches structural regressions cheaply and
reproducibly: a missing section, a forbidden preface, the wrong language, a
truncated answer. The judge catches semantic and persona-level failures that a
regex cannot express: hallucinated citations, broken character, ignored tone,
or an answer that is structurally valid but substantively wrong.

## 8. Pass, fail, error, skip

| Status | Meaning |
|---|---|
| `pass` | deterministic checks passed **and** the judge returned `pass: true` |
| `fail` | the model answered, but at least one layer failed |
| `error` | the API call, judge call, or response parsing failed |
| `skipped` | not run, for example after `--fail-fast` |

`score` is reported for visibility but does not decide the result; the judge's
`pass` boolean does. This avoids treating a high score as a pass when the judge
recorded a concrete violation.

Exit code is non-zero when there is at least one `fail` or `error`.

## 9. Model selection and fallbacks

The effective persona model is chosen in this order:

1. `case.model`,
2. `--model` / `PERSONA_MODEL`,
3. the persona's `model`,
4. `--fallback-model`.

Before running, the suite fetches `/models` (unless `--no-model-check`). If the
chosen model is not in the catalogue, it uses:

1. an entry from `MODEL_FALLBACKS` in `_tests/run.mjs`,
2. otherwise the configured fallback model.

Current fallbacks:

| Declared model | Fallback |
|---|---|
| `llama-3.3-70b-instruct` | `deepseek-v4.1-flash-1017` |
| `gemma-3-27b-it` | `gemma-4-31b-it` |
| `meta-llama-3.1-8b-rag` | `meta-llama-3.1-8b-instruct` |

The report records both `requestedModel` and the effective `model`, plus a
`modelFallback` flag. The judge model is selected separately with
`--judge-model` / `JUDGE_MODEL`.

## 10. Concurrency and reliability

- A fixed worker pool runs up to `--concurrency` cases at once.
- `--fail-fast` stops scheduling new cases after the first failure. In-flight
  cases finish; unstarted cases are recorded as `skipped`.
- `client.mjs` retries timeouts, 408, 409, 425, 429, and 5xx responses with
  exponential backoff.
- Non-retryable 4xx responses fail immediately.
- Every request has an abort-based timeout.

## 11. Reports

Both reports are written unless `--no-report` is used.

### `_tests/report.json`

Contains the run metadata, summary, and one entry per case with:

- persona path and title,
- case id and name,
- requested and effective model, and fallback flag,
- input and rubric,
- full output,
- deterministic checks,
- judge verdict, score, reason, and violations,
- token usage,
- duration and status.

### `_tests/report.md`

Contains a summary, a compact result table, and per-case details with input and
output in fenced blocks.

Both files are gitignored.

## 12. Adding a case

1. Add a persona JSON file, or pick an existing one.
2. Add an entry to `_tests/cases.mjs` with a unique `id`, the persona path, a
   realistic input, deterministic checks, and a rubric.
3. Run `node _tests/run.mjs --dry-run` to validate.
4. Run only the new case:

   ```bash
   node _tests/run.mjs --case my-new-case --verbose
   ```

5. If the failure is a legitimate persona problem, fix the persona. If the
   failure is a test problem, loosen the check. Avoid weakening a check only to
   make the suite green.

## 13. Limitations

- **Arcana/RAG is not executed.** `arcanas/fegis-bot.json` and
  `arcanas/ifi-bot.json` are tested without their knowledge base. Their cases
  focus on tone, honesty about missing references, and avoiding fabricated
  `[RREF ...]` citations.
- **Tools are not used.** The suite sends plain chat completions. MCP servers,
  web search, image generation, and other Chat AI tools are not exercised.
- **The UI is not tested.** Import, rendering, and Chat AI's request rewriting
  are out of scope.
- **LLM outputs are non-deterministic.** A persona may pass on one run and fail
  on another. Re-run a failing case before changing the persona.
- **Judge models can be biased or inconsistent.** Rubrics should describe
  observable behavior. Prefer deterministic checks for hard requirements.
- **Truncation looks like a content failure.** If the output stops mid-sentence,
  check `finish_reason` and increase `--max-tokens` before changing the rubric.

## 14. Security notes

- The API key is read from the environment or `--config` and is never logged or
  written to a report.
- Model output is stored and printed but never executed.
- The suite only talks to the configured endpoint. It does not fetch persona
  URLs or GitHub.
- Do not commit a `back.json` or `.env` with a real key. The repository's
  `.gitignore` excludes `.env`, `node_modules`, and generated reports, but not a
  custom config file you create elsewhere.
