# Chat AI Personas Repository

This repository contains JSON files that define various personas for use in [Chat AI](https://chat-ai.academiccloud.de). Each JSON file includes the system prompt, settings, and conversations, allowing you to easily load a persona into Chat AI with a simple link.

## Table of Contents
  - [Introduction](#introduction)
  - [Usage](#usage)
  - [File Structure](#file-structure)
  - [Contributing](#contributing)
  - [Notable Personas](#notable-personas)
  - [License](#license)

## Introduction

This repository is designed to provide a collection of pre-defined personas that can be used to enhance the conversational capabilities of chat AI applications. Each persona is defined in a JSON file, making it easy to integrate into your chat AI system.

## Usage

To use a persona in Chat AI, simply add the link to the JSON file in the import parameter of the URL. Here's an example:

```
https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/gwdg-support.json
```

Alternatively, pass the JSON as data URI, e.g. in a bookmark for a custom persona:

```
# plain
https://chat-ai.academiccloud.de/chat/?import=data:application/json,{ "title": "Helpful Assistant", "temperature": 0.5, "top_p": 0.5, "enable_tools": false, "model": "qwen3-32b", "model-name": "Qwen 3 32B", "messages": [ { "role": "system", "content": "You are a helpful assistant." } ] }
# base64-encoded
https://chat-ai.academiccloud.de/chat/?import=data:application/json;base64,eyAidGl0bGUiOiAiSGVscGZ1bCBBc3Npc3RhbnQiLCAidGVtcGVyYXR1cmUiOiAwLjUsICJ0b3BfcCI6IDAuNSwgImVuYWJsZV90b29scyI6IGZhbHNlLCAibW9kZWwiOiAicXdlbjMtMzJiIiwgIm1vZGVsLW5hbWUiOiAiUXdlbiAzIDMyQiIsICJtZXNzYWdlcyI6IFsgeyAicm9sZSI6ICJzeXN0ZW0iLCAiY29udGVudCI6ICJZb3UgYXJlIGEgaGVscGZ1bCBhc3Npc3RhbnQuIiB9IF0gfQ==
# url-encoded
https://chat-ai.academiccloud.de/chat/?import=data:application/json,%7B%20%22title%22%3A%20%22Helpful%20Assistant%22%2C%20%22temperature%22%3A%200.5%2C%20%22top_p%22%3A%200.5%2C%20%22enable_tools%22%3A%20false%2C%20%22model%22%3A%20%22qwen3-32b%22%2C%20%22model-name%22%3A%20%22Qwen%203%2032B%22%2C%20%22messages%22%3A%20%5B%20%7B%20%22role%22%3A%20%22system%22%2C%20%22content%22%3A%20%22You%20are%20a%20helpful%20assistant.%22%20%7D%20%5D%20%7D
```

## File Structure

The repository is organized as follows:

```
chat-ai-personas/
├── arcanas/            RAG personas with an Arcana knowledge base
├── business/           job postings, legal checks, SWOT
├── design/             icon and design helpers
├── development/        coding helpers
├── examples/           small, playful example personas
├── learning/           learning and reflection coaches
├── productivity/       agendas, tasks, presentations
├── research/           reading, glossaries, document analysis, SVG
├── translation/        translators
├── writing/            writing, rewriting, proofreading, summarizing
├── _tests/             LLM-as-judge test suite
├── assistant.json      general assistant
├── gwdg-support.json   GWDG support bot
├── PERSONAS.md         complete persona catalog
├── README.md           this file
├── AGENTS.md           instructions for AI coding agents
└── LICENSE
```

- `arcanas/`: Personas that use a knowledge base (RAG).
- `business/`: Job postings, legal document checks, SWOT analysis.
- `design/`: Design and icon-search helpers.
- `development/`: Coding and software-engineering helpers.
- `examples/`: Small, playful example personas.
- `learning/`: Learning and reflection coaches.
- `productivity/`: Agendas, task extraction, presentation planning.
- `research/`: Research, reading, glossary, document analysis, SVG generation.
- `translation/`: Translators.
- `writing/`: Writing, rewriting, proofreading, summarizing, prompt optimization.
- `_tests/`: LLM-as-judge test suite for every persona.
- `PERSONAS.md`: The complete catalog of every persona.
- `README.md`: This file.
- `AGENTS.md`: Rules for AI coding agents, including the documentation requirement.
- `LICENSE`: The license for this repository.

See [PERSONAS.md](PERSONAS.md) for the full catalog.

## JSON Structure of Personas

Persona files have the following structure:
```js
{
  "title": "Title",
  "subtitle": "Subtitle",
  "model-name": "AI model name, must be supported by Chat AI",
  "model": "AI model, must be supported by Chat AI",
  "temperature": 0.2, // should be 0 for arcanas
  "top_p": 0.2, // should be 0 - 0.05 for arcanas
  "messages": [
    {
      "role": "system",
      "content": "This is a system prompt."
    },
    { // optional
      "role": "info",
      "content": "This message is only visible to the user."
    }
  ],
  "arcana": { // optional, only for RAG
    "id" : "username/arcana-name"
  }
}
```

## Testing personas

Every persona has at least one case in the LLM-as-judge suite. To validate the
catalog and the cases without calling a model:

```bash
node _tests/run.mjs --list
node _tests/run.mjs --dry-run
```

To run a single case or the whole suite, provide an OpenAI-compatible endpoint
and API key:

```bash
node _tests/run.mjs --config ../secrets/back.json --case <case-id>
```

See [_tests/README.md](_tests/README.md) for usage and
[_tests/HOW_IT_WORKS.md](_tests/HOW_IT_WORKS.md) for internals.

## Contributing

Contributions are welcome! If you have a new persona you'd like to add, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature (`git checkout -b feature/new-persona`).
3. Add your JSON file to the corresponding directory.
4. Add the persona to the catalog in [PERSONAS.md](PERSONAS.md).
5. Add at least one test case to `_tests/cases.mjs` with an input and a judge rubric.
6. Run `node _tests/run.mjs --dry-run` and `node _tests/run.mjs --case <case-id>`.
7. Commit your changes (`git commit -m 'Add new persona'`).
8. Push to the branch (`git push origin feature/new-persona`).
9. Open a Pull Request.

Please ensure your JSON files follow the structure outlined in the existing files. A new persona is not complete until it is documented in `PERSONAS.md` and covered by a test case; see [AGENTS.md](AGENTS.md) for the full checklist.

## Notable Personas

The complete list of every persona, including its path, category, purpose, and model, is in [PERSONAS.md](PERSONAS.md).

- [assistant](https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/assistant.json):
General assistant
- [gwdg-support](https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/gwdg-support.json): GWDG Support Bot
- [research/glossary](https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/research/glossary.json): Create short definitions for terms
- [research/spellfix](https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/writing/spellfix.json): Check for errors in text by regeneration and comparison
- [translation/de_en](https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/translation/de_en.json): Simple German to English translator
- [translation/en_de](https://chat-ai.academiccloud.de/chat?import=https://raw.githubusercontent.com/gwdg/chat-ai-personas/refs/heads/main/translation/en_de.json): Simple English to German translator

## License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.

---

Thank you for using the Chat AI Personas repository! If you have any questions or need further assistance, please feel free to open an issue or contact the repository maintainers.
