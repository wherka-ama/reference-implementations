# Evals editor: research and design

Research checked on 7 November 2026. These are source-backed design decisions,
not evidence of measured user satisfaction or a claim of a universally "best"
editor.

## Problem and source evidence

The supplied suite contains 40 cases with long single-line prompts, expected
outputs and multiple long assertions. JSON encodes newlines and quotes rather
than displaying them naturally. A syntax-aware text editor helps with JSON
but does not expose the task/assertion structure or distinguish suite metadata
from case data.

| Source | Finding | Application |
| --- | --- | --- |
| [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors) | Text formats should use `CustomTextEditorProvider`; the text document provides save, undo and backup. `priority: option` makes an editor opt-in. | No custom storage layer, no default takeover of JSON. Bidirectional document synchronization. |
| [VS Code webview UX guidelines](https://code.visualstudio.com/api/ux-guidelines/webviews) | Webviews need genuine value beyond native APIs, contextual activation, theme support and accessibility. | A focused structured authoring surface, activated only on request; no welcome page or extra sidebar. |
| [GOV.UK textarea guidance](https://design-system.service.gov.uk/components/textarea/) | Use textareas for longer answers; visible labels above controls; proportional height; allow copy/paste. | Wrapped resizable prompts, outputs and assertions, with persistent labels rather than placeholder-only inputs. |
| [VS Code webview guide](https://code.visualstudio.com/api/extension-guides/webview) | Restrict local resources, use a CSP, sanitize content, and use `getState`/`setState` rather than retaining costly hidden views. | Text/value DOM assignments, nonce script, no network resources, view-state persistence, no `retainContextWhenHidden` in production. |
| [Anthropic skill-creator schemas](https://github.com/anthropics/skills/blob/main/skills/skill-creator/references/schemas.md) | Evals contain IDs, prompts, human-readable expected results, verifiable expectations and optional fixture paths. | Preserve the common format; support the supplied suite's extra metadata and case names without inventing a new schema. |
| [VS Code extension testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension) | Integration tests run in an Extension Development Host with the real VS Code APIs. | Test the native document lifecycle, not only a mocked webview. |

The upstream schema describes paths relative to a skill root, while the
provided suite uses `files/...` in a different layout. This editor deliberately
does not resolve paths or imply a runner-specific root.

## Interaction choices

### Searchable master/detail instead of a giant form or grid

A dense table works well for short scalar values but poorly for paragraph
prompts and assertions. Rendering all cases as expanded cards makes a 40-case
suite long and repetitive. The case navigator provides recognition and
search; one case form leaves room for reading and editing. Search uses all
words across case content rather than exact phrase matching.

### Individual assertion controls instead of newline-delimited lists

A newline-separated textarea would be compact, but cannot distinguish an
assertion containing a newline from two assertions. One labeled multiline
control per item preserves the exact array boundary. Explicit move buttons
are keyboard-operable and do not require drag-and-drop.

### Explicit Apply/Discard instead of every-keystroke writes

Immediate document updates make Auto Save intuitive but create invalid
intermediate IDs, noisy undo history and potential stale-write races. An
explicit field transaction permits local drafting and host validation, with
one native undo step. This comes with a real cost: users must Apply before
Save or closing, and unapplied drafts are not backed up as text documents.
The UI states that distinction prominently. Test this trade-off with users
before promoting the editor beyond an experimental release.

Suite metadata is collapsible, optional fields stay optional, deletion is
confirmed, and stale document versions cannot silently overwrite external
changes. No speculative AI generation, grading dashboard, wizard or eval
runner is bundled into this authoring task.

## Value acceptance criteria

Implemented and covered by focused tests:

- The full 40-case suite loads, and multiword search finds a specific case.
- A prompt with quotes and real newlines round-trips without manual escaping.
- A multiline assertion remains exactly one array item; add/remove/reorder
  operate on explicit boundaries.
- Unknown metadata/case fields and untouched optional-field absence survive
  editing; field edits retain unrelated text and existing tab/CRLF formatting.
- Duplicate IDs, malformed input and out-of-range actions are surfaced
  explicitly without overwriting the document.
- Native Apply/Save/Undo/Redo work; stale and concurrent views cannot overwrite
  a newer document.
- Drafts survive webview recreation, and conflicting updates preserve draft
  text rather than replacing it.
- At a 375-pixel viewport there is no horizontal document overflow; keyboard
  reorder keeps a meaningful focus target; axe finds no WCAG A/AA violations
  in the tested state.

These checks establish functional value and regressions, not usability
superiority or complete accessibility certification.

## Suggested usability validation before publishing

Recruit 5-8 eval authors, including a keyboard-only user and someone who uses
a screen reader. Counterbalance raw JSON and visual editor task order using
copies of the supplied suite. Ask each participant to:

1. Find the unbounded-tool-agent case.
2. Insert a quoted, multiline task constraint.
3. Add and reorder a measurable assertion.
4. Duplicate a case while retaining fixtures and metadata.
5. Fix a conflicting external edit, then Save and Undo.

Record task completion, syntax/data-loss incidents, elapsed time and whether
participants understand Apply versus Save. Suggested release gates: no lost
applied content, all participants can Save and Undo correctly, and at least
80% complete the assertion task without help. Compare task time against each
participant's text-editor baseline; do not claim a speed improvement without
results. Specifically revisit staged Apply if it creates save mistakes.

Manually test light/dark/high-contrast themes, 200% zoom, screen-reader
announcements, large pasted text and hide/reopen behavior. Eval-result
visualization remains a separate future scope.

## Guided SKILL.md authoring

The subsequent standards research is recorded in
[SKILL_STANDARDS.md](SKILL_STANDARDS.md). It distinguishes the portable format,
first-party harness extensions, observed loader tolerances and evidence gaps.
Important findings: body headings are unrestricted, Unicode names are part
of the reference interpretation, and Claude Code is not the same schema as
Claude.ai/API uploads. No universal ASCII rule or fixed section wizard is
imposed.

The guided surface presents target selection, task/trigger descriptions,
optional fields, a visual procedure editor and live validation. Each stage
has plain-language hints and official documentation links. Suggested sections
are optional scaffolds; author/version entries use labeled metadata rows.
Advanced YAML remains available for unknown or structured client extensions.
Profiles are local view preferences, not a field secretly added to the skill.

[Tiptap Markdown](https://tiptap.dev/docs/editor/markdown) provides the
formatting editor, but its own documentation warns about early-release
limitations and loss of comments. Therefore rich mode is explicitly guarded:
HTML/comments, images, tables, task lists and reference definitions use the
lossless Markdown surface. A semantic render round-trip check declines rich
conversion for additional incompatible input. Never normalize an untouched
body just because the file was opened or a metadata field changed.

Rich edits deliberately normalize Markdown formatting. Formatting controls
include emphasis, headings, lists, code and links; executable link schemes
are refused. Raw HTML is not inserted into a preview DOM. Referenced resources
and skill hooks are not fetched or executed, and no AI assistant is called.

Automatic validation is reassuring only if it is honest: errors block Apply,
while recommendations, ignored fields and unresolved harness differences
remain visible notes. “Format checks passed” is not security approval,
runtime certification, upload acceptance, or a judgement of prompt quality.

Extend the proposed user study with non-developer authors: create a skill
without writing YAML, explain its trigger, add numbered steps, insert an
example, resolve a validation error using an official link, then choose a
different harness. Verify that they understand optional sections, advanced
configuration and Apply versus Save. These tasks have not yet been evaluated
with human participants; browser/keyboard/axe tests are regression evidence
only.
