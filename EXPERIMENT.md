# Experiment 2: portable skills distribution layout

## Objective and isolation

Branch `experiment/skills-layout`, independently based on
`03fd6047cfe30cd76514ae5355cee47947078950`. No dependency on experiments 1, 3,
or 4. No new runtime or dependency installation is needed.

## Decision

Move the complete `tools/gsf/green-code-skill/` directory to
`skills/green-code-skill/`, retaining all instructions, references, installation
guides, and the project-local license byte-for-byte. Update the repository
overview to reflect this deliberate exception to its maintainer-first layout.
The other tools and specification implementations stay where they are.

The [Agent Skills specification](https://agentskills.io/specification) defines
the skill directory's internal format, not a mandatory repository-wide
`skills/` location. This experiment is a portable distribution convention,
not a correction of a nonconforming original skill.

Top-level `skills/` alone does not promise automatic activation in every client.
Installation or harness-specific discovery paths such as `.agents/skills/` or
`.github/skills/` remain separate concerns. No symlinks or duplicated copies are
added merely to satisfy multiple clients.

## Reproduce and acceptance

```sh
ai-primitives-hub skill validate --skills-dir skills --verbose
git diff 03fd604 --summary
```

Compare all old and new skill files by content hashes, not just filenames.
Relative links inside the complete moved directory remain valid because its
internal structure is unchanged. Historical upstream GitHub links in the skill
are not rewritten to advertise an unpublished experimental location.
Validation outcomes are recorded below after execution.

## Trade-offs

The new layout is easier for skill-oriented consumers to scan but weakens the
repository's `tools/gsf` stewardship grouping. External URLs/bookmarks for the
old location will break if this branch is merged without a migration notice.
No forwarding copy is retained because it would create a second source of truth.
The root documentation must continue identifying GSF as the skill's maintainer.

## Revert / cleanup

No merge or push is needed to inspect this experiment. Once the worktree is
clean, from the original checkout:

```sh
git worktree remove ../reference-implementations-skills-layout
```

Keep the branch for later comparison. If adopted and later undone, revert its
commits; do not reset shared history.

## Executed outcomes (2026-11-05)

- Installed Hub CLI 0.2.1 skill validation: 1 valid, 0 invalid.
- All 17 moved files were compared byte-for-byte with their original paths at
  the baseline commit; all matched, including reference documents and license.
- Git recognizes the complete directory move with unchanged contents.
- Repository overview and contribution entry points describe the new location.
- No runtime dependencies were installed and no harness auto-discovery claim
  was made. Existing tool-specific guides remain inside the intact skill.

Recommendation: choose this only if portable skill distribution outweighs the
maintainer-first taxonomy and old-path compatibility. It is not required merely
to satisfy the Agent Skills format.
