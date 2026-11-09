#!/usr/bin/env node

// LLM-as-judge test suite for every persona in this repository.
//
// Usage:
//   node _tests/run.mjs --list
//   node _tests/run.mjs --dry-run
//   OPENAI_API_KEY=... node _tests/run.mjs
//   node _tests/run.mjs --config ../secrets/back.json
//
// The suite sends each case input to the persona, checks deterministic
// expectations, then asks a judge model to score the output against a rubric.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cases } from "./cases.mjs";
import { ApiError, chatCompletion, listModels } from "./client.mjs";
import { judgeOutput } from "./judge.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_BASE_URL = "https://chat-ai.academiccloud.de/v1";
const DEFAULT_JUDGE_MODEL = "deepseek-v4.1-flash-1017";
const DEFAULT_FALLBACK_MODEL = "deepseek-v4.1-flash-1017";
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_TOKENS = 8_000;

// Personas whose declared model is not offered by the test deployment.
const MODEL_FALLBACKS = {
  "llama-3.3-70b-instruct": "deepseek-v4.1-flash-1017",
  "gemma-3-27b-it": "gemma-4-31b-it",
  "meta-llama-3.1-8b-rag": "meta-llama-3.1-8b-instruct",
};

const SKIPPED_DIRS = new Set([".git", ".github", "node_modules", "tests", "_tests", "dist", "build", "bin", "obj"]);

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const settings = resolveSettings(args);

  if (args.list) {
    listCoverage(settings);
    return;
  }

  const loaded = loadEverything(settings);
  if (args["dry-run"]) {
    dryRun(loaded, settings);
    return;
  }

  if (!settings.apiKey) {
    console.error(
      "No API key. Set OPENAI_API_KEY (or CHAT_AI_API_KEY), or pass --config <path-to-back.json>.",
    );
    process.exitCode = 1;
    return;
  }

  runSuite(loaded, settings).catch((error) => {
    console.error(`Fatal: ${error?.stack || error}`);
    process.exitCode = 1;
  });
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const [name, inlineValue] = token.slice(2).split("=");
    if (inlineValue !== undefined) {
      args[name] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      args[name] = argv[index + 1];
      index += 1;
    } else {
      args[name] = true;
    }
  }
  return args;
}

function resolveSettings(args) {
  const env = process.env;
  let config = {};
  if (typeof args.config === "string") {
    const configPath = path.resolve(process.cwd(), args.config);
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  const baseUrl =
    args["base-url"] ||
    env.OPENAI_BASE_URL ||
    env.CHAT_AI_BASE_URL ||
    config.apiEndpoint ||
    config.baseUrl ||
    config.base_url ||
    DEFAULT_BASE_URL;

  const apiKey = String(
    env.OPENAI_API_KEY ||
      env.CHAT_AI_API_KEY ||
      config.apiKey ||
      config.api_key ||
      "",
  ).trim();

  const personaModelOverride = args.model || env.PERSONA_MODEL || null;
  const judgeModel = args["judge-model"] || env.JUDGE_MODEL || DEFAULT_JUDGE_MODEL;
  const fallbackModel = args["fallback-model"] || env.FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  const concurrency = clampInteger(args.concurrency || env.TEST_CONCURRENCY, 1, 20, DEFAULT_CONCURRENCY);
  const timeoutMs = clampInteger(args.timeout || env.TEST_TIMEOUT_MS, 10_000, 900_000, DEFAULT_TIMEOUT_MS);
  const maxTokens = clampInteger(args["max-tokens"] || env.TEST_MAX_TOKENS, 256, 32_000, DEFAULT_MAX_TOKENS);

  const personaFilters = splitFilter(args.persona);
  const caseFilters = splitFilter(args.case);

  return {
    baseUrl: String(baseUrl).replace(/\/+$/, ""),
    apiKey,
    personaModelOverride,
    judgeModel,
    fallbackModel,
    concurrency,
    timeoutMs,
    maxTokens,
    personaFilters,
    caseFilters,
    noJudge: Boolean(args["no-judge"] || env.TEST_NO_JUDGE === "1"),
    failFast: Boolean(args["fail-fast"]),
    noModelCheck: Boolean(args["no-model-check"]),
    allowUncovered: Boolean(args["allow-uncovered"]),
    verbose: Boolean(args.verbose),
    quiet: Boolean(args.quiet),
    noReport: Boolean(args["no-report"]),
    outputPath: path.resolve(ROOT, args.output || "_tests/report.json"),
    markdownPath: path.resolve(ROOT, args["markdown-output"] || "_tests/report.md"),
  };
}

function splitFilter(value) {
  if (!value || value === true) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function walkJsonFiles(directory) {
  const results = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.isDirectory()) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      results.push(...walkJsonFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

function loadPersonas() {
  const files = walkJsonFiles(ROOT).sort();
  const personas = [];
  const ignored = [];
  const errors = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (["package.json", "package-lock.json"].includes(path.basename(file))) continue;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${rel}: invalid JSON (${error.message})`);
      continue;
    }

    const messages = Array.isArray(data?.messages) ? data.messages : null;
    if (!messages) {
      ignored.push(rel);
      continue;
    }

    const systemPrompt = messages
      .filter((message) => message?.role === "system")
      .map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)))
      .join("\n\n")
      .trim();

    if (!systemPrompt) {
      errors.push(`${rel}: no system message content`);
      continue;
    }

    personas.push({
      path: rel,
      file,
      data,
      title: String(data.title || path.basename(rel, ".json")),
      subtitle: String(data.subtitle || data.description || ""),
      systemPrompt,
      model: typeof data.model === "string" ? data.model : null,
      modelName: typeof data["model-name"] === "string" ? data["model-name"] : null,
      temperature: typeof data.temperature === "number" ? data.temperature : null,
      topP: typeof data.top_p === "number" ? data.top_p : null,
      arcana: data.arcana || null,
    });
  }

  return { personas, ignored, errors };
}

function loadEverything(settings) {
  const { personas, ignored, errors } = loadPersonas();
  const personaByPath = new Map(personas.map((persona) => [persona.path, persona]));

  const caseErrors = [];
  const seenIds = new Set();
  const validCases = [];

  for (const testCase of cases) {
    if (!testCase?.id || !testCase?.persona || !testCase?.input || !testCase?.expect?.rubric) {
      caseErrors.push(`Case ${testCase?.id || "(no id)"} is missing id, persona, input, or rubric.`);
      continue;
    }
    if (seenIds.has(testCase.id)) {
      caseErrors.push(`Duplicate case id: ${testCase.id}`);
      continue;
    }
    seenIds.add(testCase.id);

    if (!personaByPath.has(testCase.persona)) {
      caseErrors.push(`Case ${testCase.id} references unknown persona: ${testCase.persona}`);
      continue;
    }

    try {
      validateExpectations(testCase.expect);
    } catch (error) {
      caseErrors.push(`Case ${testCase.id}: ${error.message}`);
      continue;
    }

    if (!matchesAnyFilter(testCase.persona, settings.personaFilters)) continue;
    if (!matchesAnyFilter(testCase.id, settings.caseFilters)) continue;

    validCases.push(testCase);
  }

  const casesByPersona = new Map();
  for (const testCase of validCases) {
    if (!casesByPersona.has(testCase.persona)) casesByPersona.set(testCase.persona, []);
    casesByPersona.get(testCase.persona).push(testCase);
  }

  const filteredPersonas = personas.filter((persona) => matchesAnyFilter(persona.path, settings.personaFilters));
  const coverageIsFiltered = settings.personaFilters.length > 0 || settings.caseFilters.length > 0;
  const uncovered = coverageIsFiltered
    ? []
    : personas.filter((persona) => !casesByPersona.has(persona.path));

  return {
    personas,
    filteredPersonas,
    personaByPath,
    cases: validCases,
    casesByPersona,
    uncovered,
    ignored,
    errors: [...errors, ...caseErrors],
  };
}

function matchesAnyFilter(value, filters) {
  if (!filters.length) return true;
  return filters.some((filter) => value.toLowerCase().includes(filter.toLowerCase()));
}

function validateExpectations(expect) {
  for (const key of ["mustInclude", "mustIncludeAny", "mustNotInclude"]) {
    if (expect[key] !== undefined && !Array.isArray(expect[key])) {
      throw new Error(`${key} must be an array`);
    }
  }
  if (expect.mustIncludeAnyGroups !== undefined) {
    if (
      !Array.isArray(expect.mustIncludeAnyGroups) ||
      !expect.mustIncludeAnyGroups.every((group) => Array.isArray(group))
    ) {
      throw new Error("mustIncludeAnyGroups must be an array of arrays");
    }
  }
  for (const key of ["mustMatch", "mustNotMatch"]) {
    if (expect[key] !== undefined && !Array.isArray(expect[key])) {
      throw new Error(`${key} must be an array`);
    }
    for (const pattern of expect[key] || []) {
      compileRegex(pattern);
    }
  }
  if (expect.format && !["text", "markdown", "json", "svg"].includes(expect.format)) {
    throw new Error(`unknown format: ${expect.format}`);
  }
  for (const key of ["minChars", "maxChars"]) {
    if (expect[key] !== undefined && !Number.isFinite(Number(expect[key]))) {
      throw new Error(`${key} must be a number`);
    }
  }
}

function listCoverage(settings) {
  const loaded = loadEverything({ ...settings, personaFilters: [], caseFilters: [] });
  console.log(`Personas: ${loaded.personas.length}`);
  console.log(`Cases:    ${loaded.cases.length}\n`);
  for (const persona of loaded.personas) {
    const personaCases = loaded.casesByPersona.get(persona.path) || [];
    const marker = personaCases.length ? "OK " : "MISS";
    console.log(`${marker} ${persona.path} — ${persona.title} (${personaCases.length} case${personaCases.length === 1 ? "" : "s"})`);
    for (const testCase of personaCases) {
      console.log(`       - ${testCase.id}: ${testCase.name}`);
    }
  }
  if (loaded.errors.length) {
    console.error("\nErrors:");
    for (const error of loaded.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

function dryRun(loaded, settings) {
  console.log("Dry run: validating personas and cases without calling the API.\n");

  if (loaded.errors.length) {
    console.error("Validation errors:");
    for (const error of loaded.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (loaded.uncovered.length && !settings.allowUncovered) {
    console.error("Personas without a test case:");
    for (const persona of loaded.uncovered) console.error(`- ${persona.path}`);
    console.error("Add a case to _tests/cases.mjs, or pass --allow-uncovered.");
    process.exitCode = 1;
    return;
  }

  console.log(`Ready: ${loaded.cases.length} cases for ${loaded.filteredPersonas.length} personas.`);
  for (const testCase of loaded.cases) {
    const persona = loaded.personaByPath.get(testCase.persona);
    const requestedModel = testCase.model || settings.personaModelOverride || persona.model || settings.fallbackModel;
    console.log(`- ${testCase.id} [${persona.path}] model=${requestedModel}`);
  }
  console.log("\nSet OPENAI_API_KEY and run without --dry-run to execute.");
}

async function runSuite(loaded, settings) {
  if (loaded.errors.length) {
    console.error("Validation errors:");
    for (const error of loaded.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (loaded.uncovered.length && !settings.allowUncovered) {
    console.error("Personas without a test case:");
    for (const persona of loaded.uncovered) console.error(`- ${persona.path}`);
    console.error("Add a case to _tests/cases.mjs, or pass --allow-uncovered.");
    process.exitCode = 1;
    return;
  }

  if (!loaded.cases.length) {
    console.error("No cases selected.");
    process.exitCode = 1;
    return;
  }

  console.log(`Base URL: ${settings.baseUrl}`);
  console.log(`Persona model: ${settings.personaModelOverride || "(from persona, with fallbacks)"}`);
  console.log(`Judge model:   ${settings.noJudge ? "(disabled)" : settings.judgeModel}`);
  console.log(`Cases:         ${loaded.cases.length}`);
  console.log(`Concurrency:   ${settings.concurrency}\n`);

  let availableModels = null;
  if (!settings.noModelCheck) {
    try {
      availableModels = new Set(await listModels({ baseUrl: settings.baseUrl, apiKey: settings.apiKey }));
      console.log(`Model catalogue: ${availableModels.size} models available.`);
    } catch (error) {
      console.warn(`Could not load /models (${error.message}). Continuing without model checks.`);
    }
  }

  const startedAt = Date.now();
  const results = new Array(loaded.cases.length);
  let nextIndex = 0;
  let aborted = false;

  async function worker() {
    while (true) {
      if (aborted) return;
      const index = nextIndex;
      nextIndex += 1;
      if (index >= loaded.cases.length) return;

      const testCase = loaded.cases[index];
      const persona = loaded.personaByPath.get(testCase.persona);
      const result = await runCase({ testCase, persona, settings, availableModels });
      results[index] = result;

      if (!settings.quiet) printResult(result, settings);
      if (!result.passed && settings.failFast) aborted = true;
    }
  }

  const workers = Array.from(
    { length: Math.min(settings.concurrency, loaded.cases.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const actualResults = results.filter(Boolean);
  for (let index = 0; index < results.length; index += 1) {
    if (!results[index]) {
      results[index] = {
        persona: loaded.cases[index].persona,
        caseId: loaded.cases[index].id,
        caseName: loaded.cases[index].name,
        status: "skipped",
        passed: false,
        reason: "Skipped after --fail-fast",
      };
    }
  }

  const summary = summarize(actualResults, results, startedAt);
  printSummary(summary);

  if (!settings.noReport) {
    writeReports(results, summary, settings);
    console.log(`\nReports written to ${path.relative(process.cwd(), settings.outputPath)} and ${path.relative(process.cwd(), settings.markdownPath)}`);
  }

  if (summary.failed > 0 || summary.errors > 0) process.exitCode = 1;
}

async function runCase({ testCase, persona, settings, availableModels }) {
  const startedAt = Date.now();
  const requestedModel =
    testCase.model ||
    settings.personaModelOverride ||
    persona.model ||
    settings.fallbackModel;

  let model = requestedModel;
  let modelFallback = false;
  if (availableModels && !availableModels.has(model)) {
    const fallback = MODEL_FALLBACKS[model] || settings.fallbackModel;
    if (fallback && availableModels.has(fallback)) {
      model = fallback;
      modelFallback = true;
    } else if (availableModels.has(settings.fallbackModel)) {
      model = settings.fallbackModel;
      modelFallback = true;
    }
  }

  const temperature = clampNumber(testCase.temperature ?? persona.temperature ?? 0.5, 0, 2);
  const topP = clampNumber(testCase.topP ?? persona.topP ?? 0.8, 0, 1);
  const judgeModel = testCase.judgeModel || settings.judgeModel;

  const baseResult = {
    persona: persona.path,
    personaTitle: persona.title,
    caseId: testCase.id,
    caseName: testCase.name,
    requestedModel,
    model,
    modelFallback,
    judgeModel: settings.noJudge ? null : judgeModel,
    requiresArcana: persona.arcana || null,
    input: testCase.input,
    rubric: testCase.expect.rubric,
    output: "",
    deterministic: null,
    judge: null,
    usage: {},
    durationMs: 0,
    status: "pass",
    passed: false,
    reason: "",
    error: null,
  };

  try {
    const response = await chatCompletion({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model,
      messages: [
        { role: "system", content: persona.systemPrompt },
        { role: "user", content: testCase.input },
      ],
      temperature,
      topP,
      maxTokens: settings.maxTokens,
      timeoutMs: settings.timeoutMs,
    });

    baseResult.output = response.content;
    baseResult.usage.persona = response.usage;
    baseResult.model = response.model || model;

    const deterministic = checkExpectations(response.content, testCase.expect);
    baseResult.deterministic = deterministic;

    if (!settings.noJudge) {
      const judged = await judgeOutput({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: judgeModel,
        persona,
        testCase,
        output: response.content,
        deterministic,
        timeoutMs: settings.timeoutMs,
      });
      baseResult.judge = {
        pass: judged.pass,
        score: judged.score,
        reason: judged.reason,
        violations: judged.violations,
        repaired: Boolean(judged.repaired),
      };
      baseResult.usage.judge = judged.usage;
    }

    baseResult.passed = deterministic.passed && (settings.noJudge || baseResult.judge?.pass === true);
    baseResult.status = baseResult.passed ? "pass" : "fail";
    baseResult.reason = buildReason(baseResult);
  } catch (error) {
    baseResult.status = "error";
    baseResult.passed = false;
    baseResult.error = error instanceof ApiError
      ? { message: error.message, status: error.status, body: String(error.body).slice(0, 1_000) }
      : { message: error?.message || String(error) };
    baseResult.reason = baseResult.error.message;
  }

  baseResult.durationMs = Date.now() - startedAt;
  return baseResult;
}

function buildReason(result) {
  const parts = [];
  if (result.deterministic && !result.deterministic.passed) {
    const failed = result.deterministic.checks.filter((check) => !check.passed).map((check) => check.name);
    parts.push(`deterministic: ${failed.join("; ")}`);
  }
  if (result.judge) {
    parts.push(`judge ${result.judge.score}/100: ${result.judge.reason}`);
    if (result.judge.violations?.length) parts.push(`violations: ${result.judge.violations.join("; ")}`);
  }
  return parts.join(" | ") || "passed";
}

function checkExpectations(output, expect) {
  const checks = [];
  const text = String(output || "");
  const lower = text.toLowerCase();

  const include = (name, condition, detail) => {
    checks.push({ name, passed: Boolean(condition), detail: detail || "" });
  };

  for (const value of expect.mustInclude || []) {
    include(`must include "${value}"`, lower.includes(value.toLowerCase()), value);
  }

  if (expect.mustIncludeAny?.length) {
    const matched = expect.mustIncludeAny.find((value) => lower.includes(value.toLowerCase()));
    include(
      `must include one of: ${expect.mustIncludeAny.join(" / ")}`,
      Boolean(matched),
      matched ? `matched "${matched}"` : "none matched",
    );
  }

  for (const group of expect.mustIncludeAnyGroups || []) {
    if (!group.length) continue;
    const matched = group.find((value) => lower.includes(value.toLowerCase()));
    include(
      `must include one of: ${group.join(" / ")}`,
      Boolean(matched),
      matched ? `matched "${matched}"` : "none matched",
    );
  }

  for (const value of expect.mustNotInclude || []) {
    include(`must not include "${value}"`, !lower.includes(value.toLowerCase()), value);
  }

  for (const pattern of expect.mustMatch || []) {
    const regex = compileRegex(pattern);
    include(`must match /${pattern}/`, regex.test(text), regex.toString());
  }

  for (const pattern of expect.mustNotMatch || []) {
    const regex = compileRegex(pattern);
    include(`must not match /${pattern}/`, !regex.test(text), regex.toString());
  }

  if (Number.isFinite(Number(expect.minChars))) {
    include(`length >= ${expect.minChars}`, text.length >= Number(expect.minChars), `${text.length} chars`);
  }
  if (Number.isFinite(Number(expect.maxChars))) {
    include(`length <= ${expect.maxChars}`, text.length <= Number(expect.maxChars), `${text.length} chars`);
  }

  if (expect.format) {
    const formatResult = checkFormat(text, expect.format);
    include(`format: ${expect.format}`, formatResult.passed, formatResult.detail);
  }

  return {
    passed: checks.every((check) => check.passed),
    checks,
  };
}

function checkFormat(text, format) {
  switch (format) {
    case "json": {
      const parsed = parseJsonLoose(text);
      return { passed: parsed !== null, detail: parsed === null ? "no parseable JSON" : "valid JSON" };
    }
    case "svg": {
      const hasOpen = /<svg[\s>]/i.test(text);
      const hasClose = /<\/svg>/i.test(text);
      return { passed: hasOpen && hasClose, detail: `${hasOpen ? "open" : "no open"} / ${hasClose ? "close" : "no close"}` };
    }
    case "markdown": {
      const hasHeading = /(^|\n)#{1,6}\s/.test(text);
      const hasList = /(^|\n)\s*[-*]\s/.test(text);
      return { passed: hasHeading || hasList, detail: `${hasHeading ? "heading" : "no heading"}, ${hasList ? "list" : "no list"}` };
    }
    case "text":
    default:
      return { passed: text.trim().length > 0, detail: "non-empty text" };
  }
}

function parseJsonLoose(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.search(/[\[{]/);
  if (start === -1) return null;
  const lastObject = cleaned.lastIndexOf("}");
  const lastArray = cleaned.lastIndexOf("]");
  const end = Math.max(lastObject, lastArray);
  if (end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function compileRegex(source) {
  let flags = "";
  let pattern = String(source);
  const match = pattern.match(/^\(\?([imsx]+)\)/);
  if (match) {
    flags = [...new Set(match[1].split("").filter((flag) => "ims".includes(flag)))].join("");
    pattern = pattern.slice(match[0].length);
  }
  return new RegExp(pattern, flags);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function printResult(result, settings) {
  const status = result.passed ? "PASS" : result.status === "error" ? "ERROR" : "FAIL";
  const score = result.judge ? ` judge=${result.judge.score}` : "";
  const fallback = result.modelFallback ? ` (fallback from ${result.requestedModel})` : "";
  console.log(`${status} ${result.persona} :: ${result.caseId}${score}${fallback}`);
  if (!result.passed) {
    console.log(`     ${result.reason}`);
    if (settings.verbose && result.output) {
      console.log(`     output: ${oneLine(result.output, 500)}`);
    }
  }
}

function printSummary(summary) {
  console.log("\nSummary");
  console.log(`  total:   ${summary.total}`);
  console.log(`  passed:  ${summary.passed}`);
  console.log(`  failed:  ${summary.failed}`);
  console.log(`  errors:  ${summary.errors}`);
  console.log(`  skipped: ${summary.skipped}`);
  console.log(`  time:    ${(summary.durationMs / 1000).toFixed(1)}s`);
  if (summary.judgeAverage !== null) {
    console.log(`  judge:   ${summary.judgeAverage.toFixed(1)}/100 average`);
  }
}

function summarize(actualResults, allResults, startedAt) {
  const counted = allResults.filter((result) => result.status !== "skipped");
  const judgeScores = counted
    .map((result) => result.judge?.score)
    .filter((score) => Number.isFinite(score));

  return {
    total: allResults.length,
    passed: counted.filter((result) => result.passed).length,
    failed: counted.filter((result) => !result.passed && result.status !== "error").length,
    errors: counted.filter((result) => result.status === "error").length,
    skipped: allResults.filter((result) => result.status === "skipped").length,
    durationMs: Date.now() - startedAt,
    judgeAverage: judgeScores.length
      ? judgeScores.reduce((sum, score) => sum + score, 0) / judgeScores.length
      : null,
  };
}

function writeReports(results, summary, settings) {
  fs.mkdirSync(path.dirname(settings.outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(settings.markdownPath), { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: settings.baseUrl,
    personaModelOverride: settings.personaModelOverride,
    judgeModel: settings.noJudge ? null : settings.judgeModel,
    summary,
    results,
  };
  fs.writeFileSync(settings.outputPath, JSON.stringify(report, null, 2));

  const lines = [
    "# Persona test report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Total: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Errors: ${summary.errors}`,
    `- Skipped: ${summary.skipped}`,
    `- Duration: ${(summary.durationMs / 1000).toFixed(1)} s`,
    `- Judge average: ${summary.judgeAverage === null ? "n/a" : `${summary.judgeAverage.toFixed(1)}/100`}`,
    "",
    "| Result | Persona | Case | Model | Judge | Reason |",
    "|---|---|---|---|---|---|",
  ];

  for (const result of results) {
    const status = result.passed ? "PASS" : result.status === "error" ? "ERROR" : result.status === "skipped" ? "SKIP" : "FAIL";
    const judge = result.judge ? `${result.judge.score}/100` : "n/a";
    lines.push(
      `| ${status} | ${escapeCell(result.persona)} | ${escapeCell(result.caseId)} | ${escapeCell(
        result.model || result.requestedModel || "",
      )} | ${judge} | ${escapeCell(result.reason || "")} |`,
    );
  }

  lines.push(
    "",
    "## Details",
    "",
  );

  for (const result of results) {
    lines.push(`### ${result.caseId} — ${result.persona}`);
    lines.push("");
    lines.push(`- Model: ${result.model || result.requestedModel || "n/a"}${result.modelFallback ? ` (fallback from ${result.requestedModel})` : ""}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Judge: ${result.judge ? `${result.judge.score}/100 (${result.judge.pass ? "pass" : "fail"})` : "n/a"}`);
    lines.push(`- Reason: ${result.reason || ""}`);
    if (result.requiresArcana) lines.push(`- Requires Arcana: ${JSON.stringify(result.requiresArcana)}`);
    lines.push("");
    lines.push("Input:");
    lines.push("");
    lines.push("```text");
    lines.push(result.input || "");
    lines.push("```");
    lines.push("");
    lines.push("Output:");
    lines.push("");
    lines.push("```text");
    lines.push(result.output || result.error?.message || "");
    lines.push("```");
    lines.push("");
  }

  fs.writeFileSync(settings.markdownPath, lines.join("\n"));
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function oneLine(value, maxLength) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function printHelp() {
  console.log(`Persona test suite

Usage:
  node _tests/run.mjs [options]

Options:
  --list                  List personas and their cases, then exit
  --dry-run               Validate personas/cases without API calls
  --persona <filter>      Only personas whose path contains the filter (comma-separated)
  --case <filter>         Only case ids containing the filter (comma-separated)
  --config <path>         JSON file with apiEndpoint and apiKey (e.g. ../code/secrets/back.json)
  --base-url <url>        OpenAI-compatible base URL (default ${DEFAULT_BASE_URL})
  --model <id>            Override the persona model for all cases
  --judge-model <id>      Model used as judge (default ${DEFAULT_JUDGE_MODEL})
  --fallback-model <id>   Model used when a persona model is unavailable (default ${DEFAULT_FALLBACK_MODEL})
  --concurrency <n>       Parallel cases (default ${DEFAULT_CONCURRENCY})
  --timeout <ms>          Per-request timeout (default ${DEFAULT_TIMEOUT_MS})
  --max-tokens <n>        Max completion tokens for persona calls (default ${DEFAULT_MAX_TOKENS})
  --no-judge              Skip the LLM judge and use deterministic checks only
  --no-model-check        Do not fetch /models before running
  --allow-uncovered       Do not fail when a persona has no test case
  --fail-fast             Stop scheduling new cases after the first failure
  --output <path>         JSON report path (default _tests/report.json)
  --markdown-output <path> Markdown report path (default _tests/report.md)
  --no-report             Do not write report files
  --quiet                 Only print the summary
  --verbose               Print an output excerpt for failures
  --help                  Show this help

Environment:
  OPENAI_API_KEY / CHAT_AI_API_KEY
  OPENAI_BASE_URL / CHAT_AI_BASE_URL
  PERSONA_MODEL
  JUDGE_MODEL
  FALLBACK_MODEL
  TEST_CONCURRENCY
  TEST_TIMEOUT_MS
  TEST_MAX_TOKENS
  TEST_NO_JUDGE=1
`);
}

main();
