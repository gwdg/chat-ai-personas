# Persona catalog

This is the complete catalog of personas in this repository. It exists so users
and contributors can find every persona and so that new personas are documented
in one place.

When you add, rename, or remove a persona, update this file in the same change.
The test suite enforces that every persona has at least one case in
`_tests/cases.mjs`, but it does not parse this catalog, so keeping it current is
a human/agent responsibility.

## Categories

| Folder | Contents |
|---|---|
| `arcanas/` | Personas that use a knowledge base (Arcana/RAG). |
| `business/` | Job postings, legal document checks, SWOT analysis. |
| `design/` | Design and icon-search helpers. |
| `development/` | Coding and software-engineering helpers. |
| `examples/` | Small, playful example personas. |
| `learning/` | Learning and reflection coaches. |
| `productivity/` | Agendas, task extraction, presentation planning. |
| `research/` | Research, reading, glossary, document analysis, SVG generation. |
| `translation/` | Translators. |
| `writing/` | Writing, rewriting, proofreading, summarizing, prompt optimization. |
| root | General assistant and GWDG support. |

## Personas

| Persona | Path | Category | Purpose | Model |
|---|---|---|---|---|
| Fernerkundung & GIS Bot | `arcanas/fegis-bot.json` | arcanas | KI-Tutor zur Veranstaltung Fernerkundung und GIS | `qwen3.6-35b-a3b` (Qwen 3.6 35B A3B) |
| IfI-Bot | `arcanas/ifi-bot.json` | arcanas | Fragen zum Studium der Informatik und Data Science an der Universität Göttingen | `meta-llama-3.1-8b-rag` (Meta Llama 3.1 8B RAG) |
| Chat AI Assistant | `assistant.json` | root | Quick responses to general questions and requests, with extended capabilities. | `qwen3-30b-a3b-instruct-2507` (Qwen 3 30B A3B Instruct 2507) |
| Job Posting Writer | `business/job-posting.json` | business | Creates an inclusive, structured job posting from key points | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Legal Document Check | `business/legal-check.json` | business | Answers questions about a legal document without inventing facts | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| SWOT Analysis | `business/swot-analysis.json` | business | Produces a reconciled SWOT analysis with an assessment and prioritized actions | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Icon Finder | `design/icon-finder.json` | design | Turns a context into concepts and effective icon search keywords | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Coding Assistant | `development/coding-assistant.json` | development | Senior developer for code, debugging, refactoring, and design questions | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Boy Scout | `examples/10-year-old.json` | examples | A 10yo boy scout with limited knowledge | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| Riddle Monster | `examples/annoyingmonster.json` | examples | An annoying monster who loves riddles | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| Pretentious Celebrity | `examples/highsocietysnob.json` | examples | An arrogant classy celebrity with expensive tastes | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| Annoying Boss | `examples/passiveaggressiveboss.json` | examples | An unhelpful passive-aggressive boss | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| GWDG Support Bot | `gwdg-support.json` | root | Answers questions about GWDG services | `qwen3-30b-a3b-instruct-2507` (Qwen 3 30B A3B Instruct 2507) |
| Cognitive Bias Coach | `learning/bias-coach.json` | learning | Explains one cognitive bias at a time and how to counter it | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Agenda Planner | `productivity/agenda-planner.json` | productivity | Turns event details into a realistic agenda with organizer and moderation notes | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| My Tasks | `productivity/my-tasks.json` | productivity | Finds the tasks that actually concern you in an email, protocol, or document | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Presentation Planner | `productivity/slide-outline.json` | productivity | Turns source material into a structured slide outline with speaker notes | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| LeseCoach | `research/LeseCoach.json` | research | Das ist ein digitaler LeseCoach, der dich beim englischen wissenschaftlichen Lesen unterstützt. | `gemma-3-27b-it` (Gemma 3 27B Instruct) |
| Document Analyst | `research/document-analyst.json` | research | Extracts and analyzes information from documents according to your goal | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Glossary | `research/glossary.json` | research | Defines terms and abbreviations in your text | `llama-3.3-70b-instruct` (Meta Llama 3.3 70B Instruct) |
| SVG Generator | `research/svg-generator.json` | research | Generates editable svg graphics | `deepseek-v4-flash-0731` (DeepSeek V4 Flash 0731) |
| German to English | `translation/de_en.json` | translation | Translates German text into English | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| English to German | `translation/en_de.json` | translation | Translates English text into German | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| Translator | `translation/translation.json` | translation | Translates text faithfully while preserving formatting and meaning | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| E-Mail Writer | `writing/email-writer.json` | writing | Turns bullet points into a polished email with subject, greeting, and closing | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Grammar & Spelling Checker | `writing/grammar-and-spelling.json` | writing | Proofreads a text and returns only the corrected version | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Markdown Academic Assistant | `writing/markdown.json` | writing | Converts user prompts into well-formatted, proofread Markdown documents for academic learners. | `meta-llama-3.1-8b-instruct` (Meta Llama 3.1 8B Instruct) |
| Prompt Optimizer | `writing/prompt-optimizer.json` | writing | Rewrites prompts for clarity and structure, with concrete recommendations | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Rewrite & Improve | `writing/rewrite-improve.json` | writing | Rewrites text for clarity, style, and correctness without changing its meaning | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Spelling Fixer | `writing/spellfix.json` | writing | Fixes typos and spelling mistakes | `llama-3.3-70b-instruct` (Meta Llama 3.3 70B Instruct) |
| Synonyms | `writing/synonyms.json` | writing | Finds synonyms grouped by meaning, including register and nuance | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |
| Text Summarizer | `writing/text-summarizer.json` | writing | Summarizes long text faithfully, with optional complexity and language | `deepseek-v4.1-flash-1017` (DeepSeek V4.1 Flash) |

## Adding a persona to this catalog

Add one row with:

- the human-readable title,
- the path in backticks,
- the category folder,
- a one-sentence purpose,
- the model id and display name.

Keep the table sorted by path. If you introduce a new category folder, add it to
the Categories table as well.
