# Experiment 1: minimal AI Primitives Hub overlay

## Objective and isolation

Branch `experiment/hub-overlay`, based on `03fd6047cfe30cd76514ae5355cee47947078950`.
The original checkout, skill instructions, references, licenses, and other tools
are unchanged. Only packaging metadata, local npm tooling, and opt-in CI/release
scaffolding are added. Dependencies live in this worktree's `node_modules/`.
No GitHub release is created by local validation.

## Rationale

The documented **AI Primitives Hub: Scaffold Project** command can create a
GitHub source, but scaffolding a complete new repository would exceed this
experiment's minimal-overlay objective. The collection instead references the
existing skill directly. **AI Primitives Hub: Validate Collections** provides
the editor-side validation workflow.

The shared, pinned `@prompt-registry/collection-scripts` package is used rather
than a home-grown ZIP builder. The installed Hub CLI is a separate validation
cross-check, not an implicit dependency of `npm run build`.

## Reproduce

```sh
npm ci
npm run validate
npm run build
ai-primitives-hub collection validate
```

Inspect `dist/green-code/green-code.bundle.zip` and
`dist/green-code/deployment-manifest.yml` before
publishing. The skill's complete directory must travel with `SKILL.md`, including
references and its MIT license. No unrelated tool belongs in the archive.
The experiment's actual validation and archive inspection results are recorded
below after execution.

## GitHub source and release contract

Register this repository through **AI Primitives Hub: Add Source**, selecting the
GitHub source type (not `skills` or `awesome-copilot`). Discovery requires release
assets, not merely a collection YAML file on a branch.

The manually dispatched release workflow publishes a release whose name/tag is
`green-code-v0.1.0`, with exactly one `deployment-manifest.yml` and one
`green-code.bundle.zip`. Their collection ID/version must agree with the release.
No automatic push/tag publishing is enabled. Change the collection version,
build script, release name/tag, and asset paths together for a later version.
An existing release is not overwritten.

The source slug is derived from the repository actually publishing the release.
Locally this uses the GitHub `origin` remote; CI uses `GITHUB_REPOSITORY`.
Do not advertise the fork as an official GSF release, and do not assume that
local success proves remote discovery or installation. Those require a reviewed
release and a clean target installation.

## Trade-offs and acceptance

- No content relocation or duplicate skill source of truth.
- Noncanonical `tools/gsf/` paths may expose installer differences. Inspect the
  generated manifest and perform target-specific installation before adoption.
- Local validation/build are acceptance gates; publication and installed-target
  behavior remain separate, explicitly unexecuted gates.
- This experiment does not wrap the MCP server or dashboard into a skill.
- Installing the documented collection-scripts 1.0.6 package reported six
  moderate dependency audit findings. They are confined to development tooling
  in this worktree. No speculative override or unreviewed downgrade is applied;
  review upstream fixes before production adoption.

## Revert / cleanup

Nothing is merged or pushed. Keep this branch to preserve the experiment.
From the original checkout, remove this worktree only after checking it is clean:

```sh
git worktree remove ../reference-implementations-hub-overlay
```

Branch deletion is optional and loses the convenient experiment reference.
If merged later, revert the experiment commits rather than resetting shared
history. Do not remove the other three experiments.

## Sources

- [Collection schema](https://github.com/AmadeusITGroup/prompt-registry/blob/main/docs/author-guide/collection-schema.md)
- [Shared collection scripts](https://github.com/AmadeusITGroup/prompt-registry/blob/main/docs/author-guide/collection-scripts.md)
- [Validation](https://github.com/AmadeusITGroup/prompt-registry/blob/main/docs/author-guide/validation.md)
- [Commands and GitHub release contract](https://github.com/AmadeusITGroup/prompt-registry/blob/main/docs/reference/commands.md)
- [Publishing](https://github.com/AmadeusITGroup/prompt-registry/blob/main/docs/author-guide/publishing.md)
