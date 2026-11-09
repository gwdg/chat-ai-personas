# Persona test suite

This directory contains an LLM-as-judge test suite for every persona in the
repository. It sends a realistic input to each persona, checks deterministic
expectations (required phrases, forbidden phrases, format, length), and then asks
a judge model to score the answer against a rubric.

For the architecture, execution flow, judge protocol, and limitations, see
[HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## Requirements

- Node.js 18 or newer (uses the built-in `fetch`)
- An OpenAI-compatible API endpoint and API key
- No npm dependencies

## Quick start

From the repository root:

```bash
# List all personas and their cases
node _tests/run.mjs --list

# Validate cases and persona files without calling the API
node _tests/run.mjs --dry-run

# Run the whole suite
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://chat-ai.academiccloud.de/v1"
node _tests/run.mjs
```

You can also read the key from an existing Chat AI `back.json`:

```bash
node _tests/run.mjs --config ../secrets/back.json
```

The suite never prints or writes the API key.

## What it checks

For every case, the runner:

1. sends the persona's system prompt and the case input to the persona model;
2. evaluates deterministic checks:
   - `mustInclude`, `mustIncludeAny`, `mustIncludeAnyGroups`, `mustNotInclude`
   - `mustMatch`, `mustNotMatch` (regular expressions)
   - `minChars`, `maxChars`
   - `format`: `text`, `markdown`, `json`, or `svg`
3. sends the input, output, rubric, and deterministic results to a judge model;
4. marks the case as passed only when the deterministic checks and the judge agree.

The judge returns a score from 0 to 100, a short reason, and concrete violations.
Reports are written to `_tests/report.json` and `_tests/report.md`.

## Options

```text
--list                   List personas and cases
--dry-run                Validate without API calls
--persona <filter>       Only personas whose path contains the filter
--case <filter>          Only case ids containing the filter
--config <path>          JSON with apiEndpoint and apiKey
--base-url <url>         OpenAI-compatible base URL
--model <id>             Override the persona model for all cases
--judge-model <id>       Model used as judge (default deepseek-v4.1-flash-1017)
--fallback-model <id>    Model used when a persona model is unavailable
--concurrency <n>        Parallel cases (default 3)
--timeout <ms>           Per-request timeout (default 180000)
--max-tokens <n>         Max completion tokens for persona calls (default 8000)
--no-judge               Deterministic checks only
--no-model-check         Do not fetch /models before running
--allow-uncovered        Do not fail when a persona has no case
--fail-fast              Stop scheduling new cases after the first failure
--output <path>          JSON report path
--markdown-output <path> Markdown report path
--no-report              Do not write reports
--quiet                  Only print the summary
--verbose                Print output excerpts for failures
```

Environment variables:

| Variable | Meaning |
| --- | --- |
| `OPENAI_API_KEY` / `CHAT_AI_API_KEY` | API key |
| `OPENAI_BASE_URL` / `CHAT_AI_BASE_URL` | Endpoint, including `/v1` |
| `PERSONA_MODEL` | Override the persona model |
| `JUDGE_MODEL` | Judge model |
| `FALLBACK_MODEL` | Fallback model for unavailable persona models |
| `TEST_CONCURRENCY` | Parallel cases |
| `TEST_TIMEOUT_MS` | Per-request timeout |
| `TEST_MAX_TOKENS` | Persona completion limit |
| `TEST_NO_JUDGE=1` | Deterministic checks only |

## Adding or changing a case

Edit `_tests/cases.mjs`. Every persona must have at least one case unless you run
with `--allow-uncovered`. A case looks like this:

```js
{
  id: "translation-de-en-basic",
  persona: "translation/de_en.json",
  name: "German to English translation",
  input: "Der schnelle braune Fuchs springt über den faulen Hund.",
  expect: {
    mustIncludeAny: ["quick brown fox"],
    mustNotInclude: ["Here is", "Translation:"],
    maxChars: 250,
    rubric:
      "The output is only the English translation, with no commentary or explanation.",
  },
}
```

Guidelines:

- `rubric` must describe observable behavior, not vague quality.
- Prefer `mustIncludeAny` over `mustInclude` when several correct phrasings exist.
- Use `mustNotInclude` for persona-specific failures (commentary, invented
  citations, breaking character, wrong language).
- Keep `maxChars` generous enough for a correct answer, but tight enough to catch
  rambling or ignored output contracts.
- Add a case for every new persona file, otherwise the default run fails coverage.

## Model fallbacks

Some older personas name models that a test deployment may not offer. The runner
fetches `/models`, and if a model is unavailable it uses the mapping in
`_tests/run.mjs` (`MODEL_FALLBACKS`) or the configured fallback model. The report
shows both the requested and the effective model.

## RAG personas

`arcanas/fegis-bot.json` and `arcanas/ifi-bot.json` normally receive an Arcana
knowledge base. This suite does not run retrieval; it tests the persona's
behavior without that context. Those cases therefore focus on tone, honesty
about missing references, and the absence of fabricated `[RREF ...]` citations.
