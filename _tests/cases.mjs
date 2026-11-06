// Test cases for every persona in this repository.
//
// Each case is sent to the persona as a single user turn, then evaluated
// deterministically and by an LLM judge against the rubric.
//
// Fields:
//   id            unique case id
//   persona       path relative to the repository root
//   name          short human-readable name
//   input         user message sent to the persona
//   model         optional per-case model override
//   judgeModel    optional per-case judge model override
//   expect:
//     mustInclude       all strings must appear (case-insensitive)
//     mustIncludeAny    at least one string must appear (case-insensitive)
//     mustNotInclude    no string may appear (case-insensitive)
//     mustMatch         all regular expressions must match
//     mustNotMatch      no regular expression may match
//     minChars          minimum output length
//     maxChars          maximum output length
//     format            text | markdown | json | svg
//     rubric            what the judge should verify

export const cases = [
  {
    id: "assistant-general",
    persona: "assistant.json",
    name: "General helpful answer",
    input: "Explain in two sentences why the sky is blue.",
    expect: {
      maxChars: 700,
      mustNotInclude: ["As an AI language model", "I cannot"],
      rubric:
        "The answer is accurate, concise (about two sentences), and directly answers the question. It explains Rayleigh scattering or wavelength-dependent scattering without unnecessary preamble.",
    },
  },
  {
    id: "gwdg-support-basic",
    persona: "gwdg-support.json",
    name: "Crisp GWDG answer without references",
    input: "What is the GWDG?",
    expect: {
      mustIncludeAny: ["Göttingen", "Goettingen", "GWDG"],
      mustNotMatch: ["\\[RREF\\s*\\d+\\]"],
      maxChars: 900,
      rubric:
        "The answer identifies the GWDG as the Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen or as Göttingen's computing and IT service centre. It is crisp and honest. Since no references were supplied, it must not fabricate [RREF ...] citations.",
    },
  },
  {
    id: "fegis-bot-active-passive",
    persona: "arcanas/fegis-bot.json",
    name: "Didactic German explanation of active vs passive remote sensing",
    input: "Was ist der Unterschied zwischen aktiver und passiver Fernerkundung?",
    expect: {
      mustIncludeAnyGroups: [["aktiv", "Aktiv"], ["passiv", "Passiv"]],
      maxChars: 3500,
      rubric:
        "The answer is in German, didactic, and starts with the basic intuition before the precise definition. It correctly explains that active sensors emit their own energy while passive sensors measure reflected sunlight or emitted radiation. It uses a forestry or vegetation example where helpful and does not ask two questions at once.",
    },
  },
  {
    id: "ifi-bot-bachelor-programs",
    persona: "arcanas/ifi-bot.json",
    name: "IfI Göttingen bachelor programmes",
    input: "Welche Bachelorstudiengänge bietet das Institut für Informatik in Göttingen an?",
    expect: {
      mustIncludeAnyGroups: [["Angewandte Informatik"], ["Data Science"], ["Zwei-Fächer", "Zwei-Faecher", "2-Fächer", "Informatik"]],
      maxChars: 2500,
      rubric:
        "The answer is in German, friendly, and names the relevant bachelor options: Angewandte Informatik, Angewandte Data Science, and Informatik within the two-subject bachelor. It does not invent current lecture dates, rooms, or examination deadlines. If references are missing, it says so or stays appropriately cautious.",
    },
  },
  {
    id: "10-year-old-seasons",
    persona: "examples/10-year-old.json",
    name: "Childlike explanation of seasons",
    input: "Why do we have seasons?",
    expect: {
      maxChars: 900,
      mustNotInclude: ["axial tilt", "elliptical orbit", "solar radiation"],
      rubric:
        "The answer explains seasons at the level of an average ten-year-old, using simple words and a concrete image. It is broadly correct (Earth's tilt and the sun's angle) and does not use academic jargon or claim adult expertise.",
    },
  },
  {
    id: "annoyingmonster-riddle",
    persona: "examples/annoyingmonster.json",
    name: "Answers only in riddles",
    input: "Hello, who are you?",
    expect: {
      mustNotInclude: ["As an AI", "I am a language model"],
      maxChars: 900,
      rubric:
        "The reply stays in character as an annoying monster who only speaks in riddles. It does not give a plain, direct answer about who it is. The riddle is understandable and playful rather than nonsensical.",
    },
  },
  {
    id: "highsocietysnob-car",
    persona: "examples/highsocietysnob.json",
    name: "Pretentious celebrity reaction",
    input: "What do you think of my new car?",
    expect: {
      mustNotInclude: ["As an AI", "I am a language model"],
      maxChars: 1200,
      rubric:
        "The reply is in character: arrogant, obsessed with wealth and status, condescending toward the user, and dropping fleeting high-society gossip hints without naming anyone clearly. It does not break character or give a normal helpful car review.",
    },
  },
  {
    id: "passiveaggressiveboss-leave",
    persona: "examples/passiveaggressiveboss.json",
    name: "Passive-aggressive answer about leaving early",
    input: "Can I leave early today?",
    expect: {
      mustNotMatch: ["(?i)\\byes,? you (can|may)\\b", "(?i)\\bno,? you (cannot|can't|may not)\\b"],
      maxChars: 1200,
      rubric:
        "The reply is passive-aggressive and hints at the employee's supposed indiscretions without naming them. It never gives a clear yes or no. It stays in character as an unhelpful boss.",
    },
  },
  {
    id: "lesecoach-start",
    persona: "research/LeseCoach.json",
    name: "LeseCoach opening routine",
    input: "Ich möchte einen englischen Forschungsartikel über Klimawandel lesen.",
    expect: {
      mustIncludeAnyGroups: [["Deutsch", "German"], ["Englisch", "English"], ["Urheberrecht", "Datenschutz", "copyright", "privacy"]],
      mustMatch: ["\\?"],
      maxChars: 1800,
      rubric:
        "The reply follows the LeseCoach opening routine: it offers German or English as the working language, briefly reminds the user about copyright and privacy, and asks only one question or method at a time. It is supportive and does not start explaining climate science yet.",
    },
  },
  {
    id: "glossary-ambiguous-bank",
    persona: "research/glossary.json",
    name: "Ambiguous term handling",
    input: "bank",
    expect: {
      mustIncludeAnyGroups: [["Ambigious", "Ambiguous", "ambiguous"], ["alternative", "Alternative", "prompts"]],
      maxChars: 700,
      rubric:
        "Because 'bank' is ambiguous, the reply identifies the ambiguity and offers a short list of alternative prompts (for example bank as a financial institution and bank as a river edge). It does not silently pick one meaning and give a single definition.",
    },
  },
  {
    id: "svg-generator-circle",
    persona: "research/svg-generator.json",
    name: "Editable SVG generation",
    input:
      "Create a simple SVG of a red circle on a white background. Size 400x300, flat style, for a slide. Colors should convey meaning.",
    expect: {
      format: "svg",
      mustMatch: ["<svg", "inkscape:groupmode\\s*=\\s*[\"']layer[\"']"],
      mustIncludeAny: ["circle", "Circle"],
      mustNotMatch: ["<foreignObject", "<style", "class="],
      maxChars: 6000,
      rubric:
        "The output is a complete SVG 1.1 document with a white background and a red circle, sized 400x300, with every visual element inside an Inkscape layer. It avoids CSS classes and foreignObject, and the geometry is plausible for the requested size. It may add a short usage note, but the SVG itself must be valid and editable.",
    },
  },
  {
    id: "translation-de-en-fox",
    persona: "translation/de_en.json",
    name: "German to English translation",
    input: "Der schnelle braune Fuchs springt über den faulen Hund.",
    expect: {
      mustIncludeAny: ["quick brown fox", "Quick brown fox"],
      mustNotInclude: ["Der schnelle", "Übersetzung", "Here is", "Translation:"],
      maxChars: 250,
      rubric:
        "The output is only the English translation of the sentence, with no commentary, preface, or explanation. The meaning is preserved.",
    },
  },
  {
    id: "translation-en-de-fox",
    persona: "translation/en_de.json",
    name: "English to German translation",
    input: "The quick brown fox jumps over the lazy dog.",
    expect: {
      mustIncludeAnyGroups: [["Fuchs"], ["Hund"]],
      mustNotInclude: ["The quick", "Here is", "Translation:"],
      maxChars: 250,
      rubric:
        "The output is only the German translation of the sentence, with no commentary, preface, or explanation. The meaning is preserved.",
    },
  },
  {
    id: "translation-generic-german",
    persona: "translation/translation.json",
    name: "Generic translator with target language",
    input: "Translate into German: The meeting is postponed to Friday.",
    expect: {
      mustIncludeAnyGroups: [["Freitag"], ["verschoben", "verlegt", "verschiebt"]],
      mustNotInclude: ["Here is", "Sure", "Translation:"],
      maxChars: 300,
      rubric:
        "The output is only the German translation. It correctly renders 'postponed to Friday' and adds no commentary.",
    },
  },
  {
    id: "markdown-photosynthesis",
    persona: "writing/markdown.json",
    name: "Academic Markdown with code",
    input:
      "Explain photosynthesis for a biology student and include a short Python example that calculates light intensity from two values.",
    expect: {
      format: "markdown",
      mustMatch: ["(?m)^#{1,3} ", "```python"],
      mustNotInclude: ["As an AI", "I cannot"],
      maxChars: 3500,
      rubric:
        "The answer is a well-structured academic Markdown document with headings and at least one list. It explains photosynthesis accurately for a biology student, includes a short Python code block for light intensity, and writes in the language of the request (English). It does not chat with the user inside the document. A note after a line containing only '---' is explicitly permitted by the persona and must not count as a violation.",
    },
  },
  {
    id: "spellfix-basic",
    persona: "writing/spellfix.json",
    name: "Spelling fix with ok invitation",
    input: "This sentence have a speling mistake.",
    expect: {
      mustIncludeAnyGroups: [["has"], ["spelling"], ["ok", "OK"]],
      mustNotInclude: ["Explanation", "Here is"],
      maxChars: 400,
      rubric:
        "The reply repeats the text with corrected spelling and punctuation without changing the wording, then adds a separate paragraph inviting the user to send 'ok' to see the differences. It does not explain the corrections yet.",
    },
  },
  {
    id: "prompt-optimizer-blog",
    persona: "writing/prompt-optimizer.json",
    name: "Prompt optimization with recommendations",
    input: "write a blog post about AI",
    expect: {
      mustInclude: ["## Optimized prompt", "## Recommendations"],
      mustMatch: ["```", "(?m)^1\\. "],
      maxChars: 5000,
      rubric:
        "The reply contains an optimized prompt in a code block and six numbered recommendations. The optimized prompt is substantially more specific than the input: it defines a role, audience, goal, structure, length, and quality expectations, while preserving the original intent. It does not answer the blog-post request itself.",
    },
  },
  {
    id: "rewrite-improve-business",
    persona: "writing/rewrite-improve.json",
    name: "Business rewrite without added facts",
    input: "Our team is gonna make a big change in the way we do stuff next quarter.",
    expect: {
      mustNotInclude: ["gonna", "Here is", "I have rewritten", "As an AI"],
      maxChars: 600,
      rubric:
        "The output is only the rewritten text in a professional business style. It preserves the meaning (a significant change next quarter) and does not add facts, numbers, or commitments that were not in the input.",
    },
  },
  {
    id: "synonyms-learn",
    persona: "writing/synonyms.json",
    name: "Synonyms grouped by meaning",
    input: "learn (context: studying for an exam, formal academic writing)",
    expect: {
      mustMatch: ["(?im)meaning"],
      mustIncludeAny: ["study", "acquire", "absorb", "learn"],
      mustNotInclude: ["Would you like", "Do you want"],
      maxChars: 1200,
      rubric:
        "The reply groups synonyms by meaning and includes register or nuance labels. It does not ask follow-up questions and does not repeat the task. The synonyms fit the academic study context.",
    },
  },
  {
    id: "grammar-spelling-basic",
    persona: "writing/grammar-and-spelling.json",
    name: "Proofreading returns only corrected text",
    input: "Their going to the libary tomorow.",
    expect: {
      mustIncludeAnyGroups: [["They're", "They are"], ["library"], ["tomorrow"]],
      mustNotInclude: ["corrected", "Here is", "Explanation"],
      maxChars: 120,
      rubric:
        "The output is only the corrected sentence: 'They're going to the library tomorrow.' It fixes the pronoun, the spelling of library, and the spelling of tomorrow, and adds no explanation or commentary.",
    },
  },
  {
    id: "text-summarizer-water-cycle",
    persona: "writing/text-summarizer.json",
    name: "Faithful summary of a short text",
    input:
      "Water moves through the environment in a continuous cycle. Heat from the sun causes water from oceans, lakes, and soil to evaporate. The vapor rises, cools, and condenses into clouds. When droplets become heavy enough, they fall as precipitation, such as rain or snow. Some water then flows over the ground into rivers or soaks into the soil, where the cycle begins again.",
    expect: {
      mustIncludeAnyGroups: [["evaporat"], ["condens"], ["precipit"]],
      maxChars: 700,
      rubric:
        "The summary is faithful to the text and mentions evaporation, condensation, and precipitation as parts of the water cycle. It adds no facts that are not in the text and is clearly shorter than the original.",
    },
  },
  {
    id: "email-writer-bullets",
    persona: "writing/email-writer.json",
    name: "Email from bullet points",
    input:
      "- The last meeting went well\n- Thank you for the feedback\n- Next step is milestone 3\n- I need your input by next Wednesday",
    expect: {
      mustMatch: ["(?im)^\\*{0,2}subject\\*{0,2}\\s*:", "(?i)(dear|hello|hi)"],
      mustIncludeAnyGroups: [["milestone 3", "Milestone 3"], ["Wednesday"], ["meeting"]],
      mustNotInclude: ["As an AI"],
      maxChars: 1800,
      rubric:
        "The reply is a complete email with a subject line, greeting, body, and closing. It covers all four bullet points, asks for input by next Wednesday, and does not invent names, dates, or commitments. It is professional and reads as connected prose rather than a raw bullet list.",
    },
  },
  {
    id: "job-posting-backend",
    persona: "business/job-posting.json",
    name: "Structured inclusive job posting",
    input:
      "Company: Acme Robotics. Location: Göttingen, Germany. Role: Backend Developer. Tasks: build APIs, maintain services. Qualifications: Python, SQL, teamwork. Responsibilities: code reviews, on-call. Entry date: 2026-01-01. Deadline: 2025-12-01.",
    expect: {
      format: "markdown",
      mustIncludeAnyGroups: [["Acme Robotics"], ["Göttingen", "Goettingen"]],
      mustMatch: ["(?m)^# .*Backend", "(?m)^## (Tasks|Aufgaben)", "(?m)^## (Qualifications|Qualifikationen)", "(?m)^## (Responsibilities|Verantwortlichkeiten)"],
      maxChars: 3000,
      rubric:
        "The reply is a structured job posting with a title, tasks, qualifications, and responsibilities, plus application details. It uses inclusive, non-discriminatory language and follows the requested English language. Standard legal requirements that follow from the stated country, such as the right to work, are allowed. It must not invent job-specific experience, tools, or application documents that the user did not provide.",
    },
  },
  {
    id: "legal-check-rent",
    persona: "business/legal-check.json",
    name: "Document-grounded legal answer",
    input:
      "Document: 'The tenant must pay rent by the third working day of each month. Late payments incur a 5% fee.' Question: When is rent due and what happens if it is late?",
    expect: {
      mustIncludeAnyGroups: [["third working day"], ["5%", "five percent"], ["not legal advice", "keine Rechtsberatung", "not a substitute for legal advice"]],
      mustNotInclude: ["I cannot answer"],
      maxChars: 1400,
      rubric:
        "The answer is based only on the provided document: rent is due by the third working day of each month, and late payments incur a 5% fee. It refers to the relevant passage and ends with a clear statement that this is not legal advice. It does not invent statutes or jurisdiction-specific rules.",
    },
  },
  {
    id: "swot-spin-off",
    persona: "business/swot-analysis.json",
    name: "Reconciled SWOT with prioritized actions",
    input:
      "Subject: A small university spin-off developing a low-cost air quality sensor. Goal: decide whether to enter the consumer market. Evidence: strong sensor accuracy; limited manufacturing capacity; growing demand for home air quality monitors; large competitors; certification costs.",
    expect: {
      mustMatch: ["\\bS1\\b", "\\bW1\\b", "\\bO1\\b", "\\bT1\\b", "(?i)overall assessment", "(?i)prioriti[sz]ed actions"],
      maxChars: 10000,
      rubric:
        "The analysis correctly separates internal strengths and weaknesses from external opportunities and threats. It uses factor IDs (S1, W1, O1, T1, ...), reconciles the categories, and bases findings only on the supplied evidence. The overall assessment weighs the categories against the market-entry goal, and the prioritized actions reference the factor IDs they address.",
    },
  },
  {
    id: "icon-finder-departments",
    persona: "design/icon-finder.json",
    name: "Icon concepts and search keywords",
    input: "A slide section about university departments and organizational structure.",
    expect: {
      mustMatch: ["(?i)concepts?", "(?i)search keywords?", "(?m)^\\s*[-*] "],
      mustIncludeAny: ["building", "organization", "team", "structure", "hierarchy", "institution"],
      maxChars: 2200,
      rubric:
        "The reply has a 'Concepts' section and a 'Search keywords' section. It does not merely translate 'departments'; it proposes US English keywords that are likely to find suitable icons, such as building, organization chart, team, hierarchy, or institution. It provides at least five keywords in a plain list without quotation marks.",
    },
  },
  {
    id: "coding-assistant-type-error",
    persona: "development/coding-assistant.json",
    name: "Explains a Python TypeError",
    input: "Why does this Python code raise a TypeError? print(1 + '2')",
    expect: {
      mustIncludeAnyGroups: [["TypeError"], ["str(", "int(", "convert"]],
      mustMatch: ["```"],
      mustNotInclude: ["As an AI"],
      maxChars: 1800,
      rubric:
        "The answer correctly explains that Python cannot add an integer and a string, and shows a concrete fix such as str(1) + '2' or 1 + int('2'). It uses a code block, stays concise, and does not invent APIs or claim to have run the code.",
    },
  },
  {
    id: "bias-coach-planning",
    persona: "learning/bias-coach.json",
    name: "Relevant bias explanation",
    input: "I keep overestimating how much I can get done in a week.",
    expect: {
      mustMatch: ["(?i)planning fallacy", "\\?"],
      mustIncludeAny: ["estimate", "plan", "time", "task"],
      maxChars: 5000,
      rubric:
        "The reply identifies the planning fallacy or a closely related bias and explains it in plain language. It gives a work or study example, practical countermeasures, and ends with a personal reflection question. It does not invent studies, statistics, or citations.",
    },
  },
  {
    id: "agenda-planner-half-day",
    persona: "productivity/agenda-planner.json",
    name: "Half-day meeting agenda",
    input:
      "Half-day project meeting, 12 participants, 9:00-13:00, in person, goal: decide next milestones. Draft: status, blockers, planning. Moderator: me. We need lunch.",
    expect: {
      mustIncludeAnyGroups: [["09:00"], ["13:00"], ["break", "pause", "lunch"]],
      mustMatch: ["(?i)organizational notes", "(?i)moderation notes"],
      maxChars: 5000,
      rubric:
        "The agenda covers 9:00 to 13:00, stays within the time window, and includes lunch or a break. It turns the draft into a realistic sequence with status, blockers, and planning, and suggests an interaction method suitable for 12 people. It includes organizational and moderation notes.",
    },
  },
  {
    id: "my-tasks-dpo",
    persona: "productivity/my-tasks.json",
    name: "Role-aware task extraction",
    input:
      "Role: data protection officer. Email: 'The new AI tool will be rolled out next month. Please review the data processing agreement and confirm by Friday. Also, the cafeteria menu changed.'",
    expect: {
      mustIncludeAnyGroups: [["data processing agreement", "DPA"], ["Friday"]],
      mustMatch: ["(?i)(task|action)"],
      maxChars: 2500,
      rubric:
        "The reply identifies the relevant task for the data protection officer: review the data processing agreement and confirm by Friday. It treats the cafeteria menu as information, not as a task. It gives a concrete next step and notes any open questions, without inventing deadlines or facts.",
    },
  },
  {
    id: "slide-outline-forestry",
    persona: "productivity/slide-outline.json",
    name: "Slide outline with speaker notes",
    input:
      "Title: AI in Forestry. Audience: forestry students. Duration: 20 minutes. Source: remote sensing helps monitor forest health; drones capture images; AI detects stress; challenges: data quality, cost. Return only the Markdown outline; do not include a JSON block.",
    expect: {
      mustMatch: ["(?m)^## Slide 1", "(?i)speaker notes"],
      mustIncludeAnyGroups: [["forestry", "forest"], ["remote sensing", "drone", "stress"]],
      mustNotMatch: ["(?i)```json", "\"slides\"\\s*:"],
      maxChars: 12000,
      rubric:
        "The reply is a slide-by-slide outline with a title slide, an agenda, content slides, and a summary. It has about 6 to 10 slides, concise bullets, speaker notes, and visual suggestions. It uses only the provided source material and does not invent facts. It follows the explicit request for Markdown only and does not include a JSON block.",
    },
  },
  {
    id: "document-analyst-warranty",
    persona: "research/document-analyst.json",
    name: "Document-grounded extraction",
    input:
      "Document: 'The warranty covers manufacturing defects for 24 months from purchase. It excludes damage caused by misuse or normal wear. Claims must be submitted with proof of purchase.' Goal: extract the warranty duration, the exclusions, and the claim requirements.",
    expect: {
      mustInclude: ["24 months", "proof of purchase"],
      mustIncludeAny: ["misuse", "normal wear"],
      mustMatch: ["(?i)(evidence|source|document)"],
      maxChars: 1800,
      rubric:
        "The reply extracts the warranty duration (24 months), the exclusions (misuse and normal wear), and the claim requirement (proof of purchase). It cites the relevant passages as evidence and adds no outside facts or assumptions.",
    },
  },
];
