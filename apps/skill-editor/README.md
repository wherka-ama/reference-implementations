# Skill Editor

Opt-in VS Code visual editors for `SKILL.md` and `evals.json`. Author skill
instructions using rich text and guided metadata, then define evaluations
without manually escaping long JSON strings.

The extension edits definitions only. It does **not** execute skills, hooks
or evaluations, grade responses, interpret fixture paths, call AI services,
install skills, or display benchmark results.

## Install and try

Requires VS Code 1.96 or newer. To build from source, use Node.js 22.18+
and npm:

```sh
cd apps/skill-editor
npm ci
npm run package
code --install-extension skill-editor.vsix
```

Alternatively use **Extensions: Install from VSIX**. The publisher identifier
is for this local reference implementation, not a claim of Marketplace
publication or GSF product endorsement.

Open an `evals.json` file and choose **Reopen Editor With... > Skill Evals
Editor**, or use **Skill Editor: Open Evals Editor** from the Command Palette,
editor title or Explorer context menu. JSON remains the default editor.

A self-contained, forty-case sample is available in
[tests/fixtures/evals.json](tests/fixtures/evals.json), copied from the user's
provided green-code-skill suite. For local development, open this application
folder as the VS Code workspace and press **F5** to launch the Extension
Development Host.

## Guided SKILL.md editor

Open `SKILL.md`, choose **Reopen Editor With... > Guided Skill Editor**, or
**Skill Editor: Open Guided Skill Editor** in the Command Palette, editor title
or Explorer menu.

1. Choose **Target harness**. The portable standard is the default. Profiles
   cover Copilot VS Code/CLI, Codex, Claude Code/API/chat uploads, Kiro, Devin,
   OpenCode V2, Cursor, Gemini CLI, Goose and Windsurf/Devin Local.
   An explicitly unverified **Other harness** profile permits advanced fields
   without claiming a client-specific compatibility contract.
2. Explain the skill's name, task and activation conditions. Plain-language
   hints, optional portable fields, harness controls and metadata rows avoid
   requiring YAML knowledge. Official documentation links open only on request.
3. Write the procedure using **Visual editing**: emphasis, headings, lists,
   code blocks and links. Suggested sections have explanations and are
   optional; arbitrary existing headings are valid.
4. Live validation shows errors and notes as you edit. Errors block Apply;
   notes explain portability, ignored fields, runtime dependencies and advice.
   The host independently validates every Apply.
5. **Apply skill**, then use VS Code Save/Undo/Redo as usual.

See [standards and harness research](docs/SKILL_STANDARDS.md) before publishing
skills. Profiles are a dated offline snapshot, not runtime certification.
Claude.ai and platform documentation currently conflict; the editor exposes
that disagreement rather than inventing a single limit. Unknown fields are
preserved and can be edited in **Advanced frontmatter (YAML)**.

YAML is parsed as YAML 1.2, including real scalar types and block strings.
Edited strings are quoted for cross-parser compatibility. Comments and
unknown values survive AST-based field edits, although frontmatter formatting
may normalize. Body-only edits keep frontmatter bytes intact; metadata-only
edits keep the Markdown body byte-for-byte intact. Duplicate keys, malformed
YAML, unresolved custom tags, multiple documents and unbounded/circular alias
expansion cannot silently replace a file.

Visual body edits normalize Markdown formatting. Unsupported HTML/comments,
images, tables, task lists and reference definitions use **Markdown editing**
to avoid loss; a round-trip guard catches further conversion differences.
No raw HTML preview is activated. Frontmatter and body have source fallbacks,
and malformed YAML can be repaired in the native Markdown editor.

Some documented loaders tolerate missing frontmatter, malformed YAML or
client-specific values. Safe Code/OpenCode body-only files can remain without
frontmatter; this editor intentionally refuses to rewrite malformed YAML.
It does not reproduce lossy parser fallbacks or bypass harness security.

Unapplied drafts survive webview recreation and are retained on external
conflicts, but are not native document backups. Apply before Save or closing.

## Evals editing workflow

1. Search by ID, name, prompt, expected output, expectation text or file path.
   Space-separated terms all have to match; matching is case-insensitive.
2. Select a case. Prompts and expected outputs use wrapped, resizable
   textareas; expectations and input files have individual add, remove and
   move buttons. Multiline strings and `[auto]` markers are literal content.
3. Choose **Apply case** or **Apply metadata**. The entire action becomes one
   native VS Code document edit. **Apply does not save to disk**.
4. Use VS Code **Save** (or existing Auto Save), **Undo/Redo**, and source-control
   diffs as usual. Field changes leave unrelated formatting intact.
5. Use **Discard draft** to return to the current document. Apply or discard
   before changing cases or opening JSON source.

**Important:** unapplied form drafts are not document changes. VS Code Save,
Auto Save, dirty-tab indicators and hot-exit backups apply only after Apply.
Drafts and selection survive webview hiding/recreation using `setState`, but
closing the editor tab can lose unapplied drafts. Apply before closing.

Add, duplicate, move and delete operate immediately on the document (not the
disk). Deletion requires confirmation. IDs are never renumbered; add/duplicate
generate a collision-free ID. Structural operations reformat the `evals`
array, while field updates use targeted JSON edits.

If another editor, formatter, Undo/Redo or external update changes the
document while a draft exists, the draft is retained and Apply is blocked.
Copy any draft text you want to keep, then discard to reload. Concurrent
editor requests are serialized and stale versions are rejected in the host.

## Supported format and safety

The minimum shape is:

```json
{
  "skill_name": "example",
  "evals": [
    {
      "id": 1,
      "prompt": "User task",
      "expected_output": "Description of success"
    }
  ]
}
```

- `id` is a unique safe integer. Existing zero/negative IDs are supported.
- `name`, `expectations` (string array) and `files` (string array) are optional.
- Suite `description`, `schema_version` and `skill_version` are optional strings.
- Unknown fields at every level are preserved, not editable in the form.
  Untouched missing optional fields are not inserted.
- Changed required strings and array items cannot be blank. Existing blank
  strings can be opened for repair.
- Malformed JSON, comments, trailing commas, duplicate properties, duplicate
  IDs and unsupported known-field types are rejected without rewriting the
  file. Fix the JSON source; the view recovers when the document is valid.

Content is rendered as text, never HTML. A restrictive content security policy,
local-resource allowlist and host-side action validation protect the webview.
The extension performs no automatic network requests, telemetry, fixture
access or process execution and supports restricted/virtual workspaces.
Official links open externally only after a user action. It relies on
VS Code's text-file handling rather than writing through Node filesystem APIs.

## Tests and TDD

Behavior tests were written before the model and UI implementation. The
initial model runs failed with missing implementations; subsequent red/green
cycles included a native-host bundling failure and a recursive rich-editor
update event, caught by integration and browser tests respectively.

```sh
npm test                 # JSON/YAML edits, standard thresholds, harness deviations, fixtures
npm run test:ui          # Both editors, rich/source safeguards, keyboard, responsiveness, axe
npm run test:extension   # Both native editors, Apply/Save/Undo/Redo, stale/concurrent edits
npm run package          # Type-check, build and produce a VSIX
npm audit               # Dependency advisories, including dev tools
```

Browser tests use installed Google Chrome by default. To use another
Playwright channel, set `PLAYWRIGHT_CHANNEL`; for example install the
Playwright browser with `npx playwright install chromium`, then run with
`PLAYWRIGHT_CHANNEL=chromium`.

Native tests download VS Code 1.96.4 by default, or use an installed executable:

```sh
VSCODE_EXECUTABLE_PATH=/usr/share/code/code xvfb-run -a npm run test:extension
```

On desktop macOS/Windows, run without `xvfb-run`; on headless Linux, Xvfb is
required. Tests use a disposable user profile, extension directory and data
file, never the normal VS Code profile or supplied source suite. The browser
suite has a real DOM and a test document bridge; native tests separately
exercise the real provider with VS Code APIs.

Automated accessibility checks do not replace screen-reader and theme
testing. Before release, verify keyboard-only use, a screen reader, VS Code
light/dark/high-contrast themes, zoom, and saving/undoing from the visual tab.

## Design and contribution

See [UX research and design](docs/UX_RESEARCH.md) for sources, trade-offs,
acceptance criteria and a proposed user study. Architecture is deliberately
small: pure JSON/YAML models, a shared `CustomTextEditorProvider` transport,
and DOM UIs with Tiptap for rich Markdown, styled with VS Code theme tokens.
TypeScript is strict, production
dependencies are bundled, and development/test files are excluded from VSIX.

The packaging tool's `minimatch` dependency is overridden to the patched
11.x line to avoid GHSA-g3hv-75wg-m249. Packaging is tested with this override;
revisit it when the upstream tool adopts a patched dependency.

This experimental application lives under `apps/skill-editor` as explicitly
requested, rather than the repository's normal `tools/community` layout.
It is not listed as a GSF-maintained implementation. Follow the repository
contribution/proposal process before requesting upstream inclusion.

Licensed under [MIT](LICENSE). Bundled dependency licenses are collected from
esbuild's actual bundle inputs into
[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) by the build.
