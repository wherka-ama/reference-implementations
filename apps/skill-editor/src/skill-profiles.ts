export interface SkillField {
  key: string;
  label: string;
  kind: 'text' | 'multiline' | 'boolean' | 'string-list' | 'yaml' | 'enum';
  hint: string;
  options?: readonly string[];
}
export interface HarnessProfile {
  id: string;
  label: string;
  docs: string;
  hint: string;
  fields: readonly SkillField[];
}
export const specUrl = 'https://agentskills.io/specification';
export const bestPracticesUrl = 'https://agentskills.io/skill-creation/best-practices';

const invocation: SkillField[] = [
  { key: 'disable-model-invocation', label: 'Disable automatic invocation', kind: 'boolean',
    hint: 'Default: false. Make this skill explicitly invoked rather than automatically selected.' },
  { key: 'user-invocable', label: 'Show in the user skill menu', kind: 'boolean',
    hint: 'Default: true. False hides the skill from the slash-command menu.' },
  { key: 'argument-hint', label: 'Argument hint', kind: 'text',
    hint: 'Example: [issue-number]. A menu hint, not validation of user input.' }
];
const fork: SkillField[] = [
  { key: 'context', label: 'Execution context', kind: 'enum', options: ['fork'],
    hint: 'Omit to run inline. fork runs in a subagent; support depends on the harness.' }
];
const claudeFields: SkillField[] = [
  ...invocation, ...fork,
  { key: 'when_to_use', label: 'Additional activation guidance', kind: 'multiline',
    hint: 'Appended to the description. The combined listing is capped at 1,536 characters.' },
  { key: 'arguments', label: 'Named arguments', kind: 'string-list',
    hint: 'Space-separated names or a YAML list. Names correspond to positional arguments.' },
  { key: 'disallowed-tools', label: 'Tools to remove for this turn', kind: 'string-list',
    hint: 'Space/comma-separated names or a YAML list. This differs from allowed-tools permission grants.' },
  { key: 'model', label: 'Model', kind: 'text', hint: 'A /model value or inherit. Availability depends on configuration.' },
  { key: 'effort', label: 'Reasoning effort', kind: 'enum', options: ['low', 'medium', 'high', 'xhigh', 'max'],
    hint: 'Supported levels depend on the model; environment settings can override this.' },
  { key: 'agent', label: 'Subagent type', kind: 'text', hint: 'Used only with context: fork. Consult your configured agents.' },
  { key: 'background', label: 'Run the fork in the background', kind: 'boolean',
    hint: 'Default: true. Only applies with context: fork; noninteractive/SDK modes can force waiting.' },
  { key: 'paths', label: 'Matching file paths', kind: 'string-list',
    hint: 'Comma-separated globs or a YAML list. Relative to the current working directory.' },
  { key: 'shell', label: 'Dynamic-context shell', kind: 'enum', options: ['bash', 'powershell'],
    hint: 'Default: bash. Applies to dynamic command injection. This editor never runs those commands.' },
  { key: 'hooks', label: 'Session hooks (advanced YAML)', kind: 'yaml',
    hint: 'Event → matcher groups → handlers. Hooks can execute commands or send data when used by Claude. Shape validation is not a security review.' }
];
export const portableFields: readonly SkillField[] = [
  { key: 'name', label: 'Skill name', kind: 'text',
    hint: 'Portable: 1–64 lowercase alphanumeric characters and hyphens; no edge/double hyphens. Match the folder name.' },
  { key: 'description', label: 'What the skill does and when to use it', kind: 'multiline',
    hint: 'Explain the task and its trigger. Example: Summarize reports. Use when reviewing monthly financial reports. Portable maximum: 1,024 characters.' },
  { key: 'license', label: 'License', kind: 'text',
    hint: 'Optional license identifier or reference to a bundled license file. Not required by the standard.' },
  { key: 'compatibility', label: 'Environment requirements', kind: 'multiline',
    hint: 'Optional. Product, tools or network requirements, not a harness-selection setting. Portable maximum: 500 characters.' },
  { key: 'allowed-tools', label: 'Pre-approved tools', kind: 'string-list',
    hint: 'Portable: a space-separated string. Experimental and harness-dependent; not a universal tool restriction or sandbox.' }
];
export const profiles: readonly HarnessProfile[] = [
  { id: 'portable', label: 'Portable Agent Skills', docs: specUrl, fields: [],
    hint: 'The format standard, including Unicode names. Required name and description; no mandatory Markdown sections.' },
  { id: 'copilot-vscode', label: 'GitHub Copilot — VS Code', docs: 'https://code.visualstudio.com/docs/agent-customization/agent-skills',
    fields: [...invocation, ...fork], hint: 'VS Code documentation plus observed loader tolerances. allowed-tools is not documented as supported; context: fork is experimental and requires the skill tool setting.' },
  { id: 'copilot-cli', label: 'GitHub Copilot — CLI', docs: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills',
    fields: [], hint: 'CLI documentation confirms name, description, license and allowed-tools. Do not assume VS Code invocation fields work here.' },
  { id: 'codex', label: 'OpenAI Codex', docs: 'https://developers.openai.com/codex/skills', fields: [],
    hint: 'The observed loader defaults name to the folder and requires description. UI/invocation controls belong in agents/openai.yaml, not SKILL.md.' },
  { id: 'claude-code', label: 'Claude Code', docs: 'https://code.claude.com/docs/en/skills', fields: claudeFields,
    hint: 'All fields are optional; description is recommended. Supports client-only fields, list tools and documented boolean aliases. Not the same as Claude uploads.' },
  { id: 'claude-api', label: 'Claude Skills API', docs: 'https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview',
    fields: [], hint: 'Only the six standard fields. Required name/description; 64/1,024 limits and no XML tags. Reserved name wording is ambiguous; check warnings.' },
  { id: 'claude-ai', label: 'Claude.ai uploads', docs: 'https://support.claude.com/en/articles/12512198-how-to-create-custom-skills',
    fields: [], hint: 'Official help allows human-friendly names and says 200 description characters; platform docs disagree. Conflicts are warnings, not invented universal restrictions.' },
  { id: 'kiro', label: 'Kiro', docs: 'https://kiro.dev/docs/skills/', fields: [],
    hint: 'Required matching lowercase name (64 max), description (1,024 max), optional license/compatibility/metadata. Powers and steering files use different formats.' },
  { id: 'devin', label: 'Devin', docs: 'https://docs.devin.ai/product-guides/skills',
    fields: [invocation[0]!, invocation[2]!,
      { key: 'triggers', label: 'Invocation triggers', kind: 'yaml', hint: 'List of user and/or model. Default: [user, model]. [user] disables automatic activation.' },
      { key: 'permissions', label: 'Tool permissions (advanced YAML)', kind: 'yaml',
        hint: 'A map with allow, deny and ask lists of tool matchers. Only documented structure is checked; not a permission guarantee.' }],
    hint: 'Name defaults to the folder. Adds triggers and permissions. Recommended discovery path is .agents/skills, plural; rules/playbooks are separate.' },
  { id: 'opencode', label: 'OpenCode V2', docs: 'https://opencode.ai/docs/skills/', fields: [invocation[0]!],
    hint: 'Path determines the ID; name is an optional display label. No runtime name/description limits documented. metadata.opencode/autoinvoke overrides disable-model-invocation.' },
  { id: 'cursor', label: 'Cursor', docs: 'https://cursor.com/docs/skills',
    fields: [invocation[0]!,
      { key: 'paths', label: 'Matching file paths', kind: 'string-list', hint: 'Comma-separated globs or a YAML list.' },
      { key: 'globs', label: 'Legacy path globs', kind: 'string-list', hint: 'Legacy fallback for paths; prefer paths for new skills.' },
      { key: 'icon', label: 'Custom Mode badge icon', kind: 'text', hint: 'Optional badge. Default: lightning. Applies to Custom Modes.' },
      { key: 'color', label: 'Custom Mode badge color', kind: 'enum',
        options: ['default', 'green', 'cyan', 'blue', 'purple', 'magenta', 'orange', 'yellow', 'red', 'brand'],
        hint: 'Applies to Custom Mode badges, not skill execution.' }],
    hint: 'Required lowercase name matching the folder and description. Adds paths and badges; .mdc rule fields are not skill fields.' },
  { id: 'gemini-cli', label: 'Gemini CLI', docs: 'https://geminicli.com/docs/cli/skills/', fields: [],
    hint: 'The observed loader reads only string name and description. Other fields are ignored. Names are sanitized; tool consent and disabling are managed outside frontmatter.' },
  { id: 'goose', label: 'Goose', docs: 'https://goose-docs.ai/docs/guides/context-engineering/using-skills/', fields: [],
    hint: 'Official docs require name and description. Other client extensions and hard length enforcement were not verified.' },
  { id: 'windsurf', label: 'Windsurf / Devin Local', docs: 'https://docs.devin.ai/desktop/devin-local/customizations',
    fields: [], hint: 'Windsurf skills docs redirect to Devin Local. name/description examples and legacy .windsurf/skills discovery are documented; do not assume Devin Cloud extensions.' },
  { id: 'other', label: 'Other harness — compatibility unverified', docs: specUrl, fields: [],
    hint: 'No verified client-specific contract. Baseline YAML/value checks only; advanced fields are preserved with notes. This profile does not certify acceptance by any harness.' }
];
export function getProfile(id: string): HarnessProfile {
  const profile = profiles.find(value => value.id === id);
  if (!profile) throw new Error(`Unknown harness profile: ${id}.`);
  return profile;
}
export function claudeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0) return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(lower)) return true;
    if (['false', 'no', 'off', '0'].includes(lower)) return false;
  }
  return undefined;
}
