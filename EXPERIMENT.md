# Experiment 3: Agent Plugins 1.0.0 package

## Objective and isolation

Branch `experiment/agent-plugin`, independently based on
`03fd6047cfe30cd76514ae5355cee47947078950`. This is not a Claude plugin-format
migration. The target is the published portable Agent Plugins 1.0.0 standard.

## Layout and decisions

`green-software/` is the plugin root, containing `plugin.json`, `skills/`,
`README.md`, and `LICENSE`. The repository remains a monorepo; the distributable
plugin is this self-contained directory, not every unrelated reference
implementation. The entire existing skill is moved intact under
`green-software/skills/green-code-skill/`.

The documented `ai-primitives-hub plugin create green-software --path .` command
generated the initial standard manifest. This is a package authoring helper,
not proof that Hub installation or all three evaluation CLIs support the spec.
The portable manifest contains only standard metadata; component discovery uses
the fixed `skills/` location, not nonstandard manifest `skills` fields.
No MCP component is invented: the independent `mcp-sci` project would need a
separate decision on its runtime dependencies, lifecycle, and packaging.

## Reproduce

```sh
npm ci
npm run schema:fetch
npm run validate
npm test
npm run build
tar -tzf dist/green-software-0.1.0.tar.gz
```

The official 1.0.0 JSON Schema is downloaded once into this worktree's ignored
`.cache/`. Validation/tests can then run offline. This network fetch is a
development operation, not a plugin client's schema loading behavior. The
specification prohibits clients fetching schemas during plugin loading.
No schema, credential, or dependency directory is included in the archive.

## Conformance scope

- Official JSON Schema validation covers the closed manifest and metadata.
- Shared Agent Skills validation covers the existing skill's frontmatter.
- The package checker requires immediate-child discovery, a license per skill,
  regular files, and no symlinks. Rejecting all symlinks is a deliberately
  stricter packaging policy than the specification's permitted internal links.
- Tests exercise a valid package, invalid legacy author metadata, and external
  symlink rejection. All original skill file contents must remain identical.
- No MCP configuration is shipped, so MCP wire conformance is not claimed.
- Client conformance, installation, activation, and multi-client portability
  require separate integration tests. A valid package alone proves none of them.

The documented collection-scripts 1.0.6 dependency has upstream moderate npm
audit findings; it is isolated development tooling, not plugin runtime content.
Review fixes before production adoption rather than silently changing the
documented packaging implementation.

Validation results and archive inspection are recorded below after execution.

## Revert / cleanup

The original checkout is untouched. Once clean, remove only this worktree:

```sh
git worktree remove ../reference-implementations-agent-plugin
```

Retain `experiment/agent-plugin` for comparison. If adopted, use revert commits
to undo the move and wrapper; do not rewrite shared history.

## Sources

- [Normative Agent Plugins 1.0.0 specification](https://agent-plugins.org/specification)
- [Official manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)
- [Agent Skills specification](https://agentskills.io/specification)
- [Documented plugin authoring command](https://github.com/AmadeusITGroup/prompt-registry/blob/main/docs/reference/commands.md)

## Executed outcomes (2026-11-05)

- Official manifest schema fetched successfully; observed SHA-256:
  `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883`.
- Manifest validated with Ajv 8.20.0. Shared skill validator: 1/1 valid.
- Three tests passed: complete package, legacy string-author rejection, and
  external symlink rejection.
- All 17 relocated original skill files matched the baseline byte-for-byte.
- Built `dist/green-software-0.1.0.tar.gz`; archive inspection confirmed a single
  self-contained `green-software/` root with manifest, skill, README, and license.
  No `node_modules/`, downloaded schema, other tools, or credentials are bundled.
- The initial older Ajv pin was updated to 8.20.0 after its audit finding.
  The remaining six moderate findings belong to the shared packaging toolchain.
- No native client activation test was executed; conformance is a package-level
  result, not a guarantee of implementation support by Copilot, Devin, or Kiro.

Recommendation: prefer this package when consumers explicitly support Agent
Plugins 1.0.0. It is a larger distribution decision than experiment 1 and should
not silently replace existing manual skill installation instructions.
