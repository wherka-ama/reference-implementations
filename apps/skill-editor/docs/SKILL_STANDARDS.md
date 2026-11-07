# SKILL.md standard and harness compatibility

Research completed **7 November 2026, before implementation**. Sources below
are first-party documentation and, where available, official loader code.
This is a dated compatibility snapshot, not a universal schema or a claim
that all installed versions behave identically.

## Standard, recommendation and runtime are different

The [Agent Skills specification](https://agentskills.io/specification)
requires YAML frontmatter followed by Markdown. Its six top-level fields are:

| Field | Standard contract |
| --- | --- |
| `name` | Required string, 1–64 characters; lowercase Unicode alphanumeric characters and hyphens; no leading, trailing or consecutive hyphens; matches the parent directory. |
| `description` | Required non-empty string, 1–1,024 characters; explains what the skill does and when to use it. |
| `license` | Optional string identifying a license or bundled license file. |
| `compatibility` | Optional string, 1–500 characters, describing environment requirements. |
| `metadata` | Optional map of string keys to string values. Author/version belong here, not in invented top-level fields. |
| `allowed-tools` | Optional space-separated string; explicitly experimental and implementation-dependent. |

The spec wording mixes “Unicode” with ASCII examples. The current
[reference validator](https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py)
explicitly normalizes names using NFKC and accepts Unicode alphanumeric
characters. This editor therefore does **not** silently turn the portable
standard into an ASCII-only rule. Some harnesses are stricter.

**There are no format restrictions on the Markdown body.** Steps, examples
and edge cases are recommended sections, not mandatory headings. Under
500 lines and roughly 5,000 tokens is authoring guidance, not a schema limit.
`scripts/`, `references/`, `assets/` and relative references are conventions.
The editor's section suggestions are optional insertions, not a fixed template.

The current [skills-ref parser](https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/parser.py)
uses StrictYAML. That subset differs from general YAML: aliases, anchors,
explicit tags and flow collections are a portability concern. The reference
validator also rejects unexpected top-level fields. The editor accepts safe,
bounded ordinary YAML, reports narrower-parser concerns, and never claims
that its checks are identical to `skills-ref validate`.

## Compatibility matrix

“Ignored” means verified loader behaviour or an explicit vendor statement.
“Not documented” is an evidence gap, **not** proof that a field works or is
rejected. Unknown fields are preserved; outside the portable/API profiles,
they produce notes rather than preventing unrelated authoring.

| Target | Name / description | Documented extensions and important deviations |
| --- | --- | --- |
| [Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | Docs require both with 64/1,024 limits and an ASCII name. Observed loader defaults missing name to the folder, replaces mismatched names, and sanitizes/truncates listings. Missing description normally warns, but certain explicit invocation settings require it. | `user-invocable` default true, `disable-model-invocation` default false, `argument-hint`; experimental `context: fork` requires the skill-tool setting. The supported-attribute list includes license/compatibility/metadata, but not allowed-tools. |
| [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills) | Name/description required in docs. Hard numeric enforcement not verified. | License and allowed-tools documented. Unlisted tools prompt for permission. VS Code invocation fields are not established CLI extensions. |
| [Codex](https://developers.openai.com/codex/skills) | Docs require name; observed loader permits omission and defaults it to the directory. Name is capped at 64; no charset check found. Description required; loader collapses whitespace, with no SKILL.md description cap found. | Only `metadata.short-description` is read from additional metadata. Other standard fields are ignored by the observed parser. Invocation policy, interface and tool dependencies live in **agents/openai.yaml**, not SKILL.md. |
| [Claude Code](https://code.claude.com/docs/en/skills) | All fields optional; description recommended. Name defaults to directory; description falls back to the first non-empty body line. Description + when_to_use listing capped at 1,536. No current Code name cap documented in the reviewed reference. | Invocation, arguments, tool lists, model/effort, fork/agent/background, paths, shell and hooks; see the field table below. Unknown keys explicitly ignored. This is not the upload schema. |
| [Claude Skills API](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) | Required name/description; 64/1,024 limits; lowercase alphanumeric/hyphen name, no XML tags, reserved words anthropic/claude. | Only six standard fields accepted. Code-specific fields cause an upload error. Reserved-word substring semantics and exact Unicode support are not specified. |
| [Claude.ai uploads](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) | Help article says human-friendly name ≤64, example “Brand Guidelines”, description ≤200, and matching folder. Platform docs instead require lowercase-hyphen names and ≤1,024 description. | Conflicting first-party rules are surfaced as notes. Fields remain limited to the standard set per the Code documentation's upload section. Do not equate “format checks passed” with upload acceptance. |
| [Kiro](https://kiro.dev/docs/skills/) | Required lowercase name matching folder, ≤64; required description ≤1,024. | Optional license/compatibility/metadata. No invocation/tool extension verified. Steering, custom-agent JSON and Powers are separate artifacts. CLI-only argument substitution is not a frontmatter extension. |
| [Devin](https://docs.devin.ai/product-guides/skills) | Name falls back to directory; description documented. Hard length enforcement not verified. | allowed-tools, argument-hint, triggers default [user, model], disable-model-invocation, permissions with allow/deny/ask lists. Rules' trigger/globs/always_on are not skill fields. |
| [OpenCode V2](https://opencode.ai/docs/skills/) | All frontmatter optional. Path determines ID; name is a display label. Description omission hides the skill from the model. V2 explicitly does not enforce portable regex, name/folder match or length limits. | metadata.opencode/autoinvoke=false hides the listing and takes precedence over disable-model-invocation. License/compatibility accepted but not interpreted. Runtime permissions belong in opencode.json, not frontmatter. Older V1 rules must not be assumed for V2. |
| [Cursor](https://cursor.com/docs/skills) | Name/description required; lowercase name matches parent folder. Numeric limits not stated in the reviewed field table. | paths (comma-separated string/list), legacy globs fallback, disable-model-invocation; icon and color for Custom Mode badges; metadata. .mdc rule fields are separate. |
| [Gemini CLI](https://geminicli.com/docs/cli/skills/) | Observed loader requires string name/description; no length caps. Replaces filesystem-special name characters with hyphens. | Loader reads only name/description and ignores other keys. Consent and disabling are outside frontmatter. Its permissive malformed-YAML fallback is not reproduced by this authoring editor. |
| [Goose](https://goose-docs.ai/docs/guides/context-engineering/using-skills/) | Docs require YAML name/description; no hard limits verified. | No additional frontmatter extensions verified. Supports shared .agents skills and plugin namespaces. |
| [Windsurf / Devin Local](https://docs.devin.ai/desktop/devin-local/customizations) | Windsurf skills documentation redirects to Devin Local. Name/description examples documented. | Legacy .windsurf/skills discovery remains supported. Devin Cloud-only frontmatter extensions are not assumed for Local. |

### Claude Code field forms

Source: [complete frontmatter reference](https://code.claude.com/docs/en/skills).

| Field | Documented type/forms and meaning |
| --- | --- |
| name, description, when_to_use | Strings. when_to_use is appended to the description. Name refuses invisible/control/private-use/unassigned/bidi characters, irregular spaces and angle brackets; reserved folders include synced and anthropic-skills. |
| disable-model-invocation, user-invocable | Boolean; defaults false/true respectively. Code also accepts yes/no/on/off/1/0 in any case. The form writes canonical true/false when edited, preserving untouched source forms. |
| argument-hint | String shown in argument autocomplete; not an argument validator. |
| arguments | Space-separated string or YAML string list, naming positional arguments. |
| allowed-tools, disallowed-tools | Space/comma-separated string or YAML string list. allowed-tools grants permissions for the turn; it does **not** restrict available tools. disallowed-tools removes tools for the turn. |
| context, agent | context: fork runs a subagent; agent selects its type. No undocumented context values are invented. |
| background | Boolean, default true, only with fork. Noninteractive/SDK modes and other runtime conditions may force waiting. |
| model | String matching a configured /model value or inherit; availability is not validated offline. |
| effort | low, medium, high, xhigh, max; actual support depends on model and environment overrides. |
| paths | Comma-separated globs or YAML string list; relative to working directory. |
| shell | bash or powershell, default bash; applies to dynamic body command injection. PowerShell availability is runtime-dependent. |
| hooks | Event mapping → matcher-group lists → handler lists. Registration can persist for the session. The editor never invokes hooks. |
| license, compatibility, metadata | Accepted. Compatibility ≤500; metadata is a free-form map and non-map metadata is dropped by Code. |

### Hook checks are intentionally bounded

The [official hooks reference](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents)
documents handler types command, http, mcp_tool, prompt and agent, with their
required fields. The editor checks the event/group/handler structure, required
string fields, finite numeric timeout and selected boolean/list fields.

It does **not** certify event names, event-specific matcher behaviour, command
paths, remote destinations, MCP availability, security, effective permissions,
managed policy or aggregate session limits. Those gaps produce an explicit
note. There is no published complete machine-readable schema in the reviewed
docs. Version-dependent source budgets (1,024 hooks / 16,384 matcher characters
per source in v2.1.304+) cannot be established from a single file.

## Discovery and invocation are separate from file authoring

The contributed editor is opt-in for `SKILL.md`; it does not install a skill,
register a plugin, resolve referenced files, or launch a harness. Useful
first-party discovery differences include:

- Copilot: .github/skills, .claude/skills, .agents/skills; personal .copilot and
  shared .agents locations. CLI and VS Code configurations differ.
- Codex: .agents/skills along the working-directory-to-repository-root path,
  user .agents and administrator /etc/codex/skills; explicit $name or /skills.
- Claude Code: .claude/skills, personal skills, managed/plugin/additional-dir
  sources. Dynamic injection and fork features do not work in API/chat uploads.
- Kiro: .kiro/skills; workspace overrides global; global skills are IDE/CLI-only.
- Devin: **.agents/skills**, plural, plus .devin/.github/.claude/.cognition/
  .windsurf/.cursor/.codex/.codeium compatibility paths. The singular
  .agent/skills path is **not** established by the reviewed documentation.
- OpenCode V2: .opencode, .agents, .claude and configured local/HTTP skill
  sources, path-derived IDs; flat root Markdown files are also documented.
  This release's custom-editor selector remains SKILL.md, not arbitrary files.
- Cursor: shared .agents and .cursor skills, compatibility sources and nested
  scoped skill folders.
- Gemini CLI: .gemini/.agents user/workspace tiers, one-level discovery;
  .agents wins within a tier. activate_skill requires consent.
- Goose: shared .agents and legacy .goose/.claude sources; plugin namespaces.

Do not add AGENTS.md, GEMINI.md, steering, .mdc rules, openai.yaml policy or
opencode.json configuration keys to frontmatter just because a harness also
uses those artifacts.

## Validation policy and evidence limits

Errors block Apply: malformed/ambiguous YAML; missing target-required values;
documented type/enum/limit failures; nonportable top-level keys in the strict
portable/API/upload profiles. Safe YAML parsing rejects unresolved custom
tags, duplicate keys, circular or excessive alias expansion, and multiple
document delimiters. Nonfinite numbers and integers the editor's JSON message
transport cannot represent exactly are rejected rather than silently rounded;
use quoted metadata text or the native source editor. Limits of the parser are
**editor safety constraints**, not invented Agent Skills requirements.

Notes do not block Apply: authoring advice, unknown/ignored fields in a
runtime profile, documented fallback/sanitization/truncation, Unicode/parser
portability concerns, offline permission gaps and conflicting official docs.
Thus a valid OpenCode human-readable label or Claude list of tools is not
rejected by imposing the portable intersection on every client.

The Claude.ai help article reports `dateModified: 2026-10-30T17:08:37Z`.
Its 200-character description cap and human-friendly names conflict with the
platform overview. We preserve that disagreement instead of choosing a fake
universal requirement. Recheck the current upload UI before publishing.

Official code inspected:

- [VS Code prompts service](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/common/promptSyntax/service/promptsServiceImpl.ts),
  [validator](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/common/promptSyntax/languageProviders/promptValidator.ts)
  and [locations](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/common/promptSyntax/config/promptFileLocations.ts).
- [Codex parser](https://github.com/openai/codex/blob/main/codex-rs/skills/src/parser.rs)
  and [metadata interface](https://github.com/openai/codex/blob/main/codex-rs/skills/src/metadata.rs).
- [Gemini CLI skill loader](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/skills/skillLoader.ts).

Code reads used main, not immutable release tags. Observed HEADs were
VS Code c1f93e8314a002f389dbddb21f459b93c9641302 (1.146.0) and Codex
57e64682f8ef83c09cc868c39010733dd6760805; the exact pinned blobs were not
re-read, so those hashes are discovery context, not claimed verified pins.
Closed loaders were not tested. No skill, hook, installer or agent command
was executed during research.

Amp's attempted first-party skill URL redirected to generic documentation;
no verified profile was invented. Roo Code and Antigravity were not verified
within this research scope. Additional harnesses can be added only with
first-party evidence and focused tests; unknown extensions can still be
retained and edited as advanced YAML. The explicit Other harness profile
marks compatibility as unverified rather than pretending a known client
contract applies.
