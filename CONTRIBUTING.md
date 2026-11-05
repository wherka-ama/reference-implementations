# Contributing to Reference Implementations

Thank you for your interest in contributing. This document describes
how to propose, build, and submit a new reference implementation — or
improve an existing one.

This repository is governed by the Green Software Foundation. All
contributions are expected to follow the GSF Code of Conduct and the
process described below.

## Two ways to contribute

There are two main paths:

1. **Add a new reference implementation** to either `specifications/`
   or `tools/`. This is the more involved path.
2. **Improve an existing reference implementation** — bug fixes,
   documentation updates, additional fixtures, methodology
   refinements, or expanded coverage. This follows standard
   fork-and-pull-request practice.

Both paths are described below.

## Adding a new reference implementation

### Step 1 — Decide where it belongs

On this experimental branch, the GSF-maintained skill is packaged under
[`green-software/skills/green-code-skill/`](./green-software/skills/green-code-skill/).
[`green-software/`](./green-software/) is a self-contained Agent Plugins 1.0.0
package; other tools retain the categories below. See
[`EXPERIMENT.md`](./EXPERIMENT.md) for the plugin's scope and compatibility limits.

The repository has two top-level categories:

- **`specifications/<spec-name>/`** for implementations of GSF
  specifications applied to specific workload classes. Examples:
  SCI applied to a web-service workload, SCI for AI applied to model
  training, and so on.
- **`tools/`** for developer-facing tools that encode green-software
  practices into working software. Examples: agent skills, code-review
  assistants, linters, GitHub Actions, dashboards.

Within each category, choose:

- **`gsf/`** — implementations maintained directly by the Green
  Software Foundation. New contributions are typically reviewed and
  placed here in coordination with the relevant working group, so most
  external contributions land in `community/` initially.
- **`community/`** — for contributions maintained by the broader
  community. **This is where most new contributions go.** Contributors
  of any kind — member organisations, individuals, students,
  researchers — are welcome here.

If you're not sure which category fits, open a discussion issue first.

### Step 2 — Open a proposal issue

Before writing significant code, please open an issue describing your
proposed reference implementation:

- **What it implements** — which GSF specification, or which green-software
  practice it encodes.
- **What form it takes** — measurement implementation, agent skill,
  linter, GitHub Action, dashboard, etc.
- **The workload class or use case** it covers.
- **Scope statement** — what's in and out of scope for this specific
  contribution.
- **How it relates** to any existing entries.

This step helps maintainers and the relevant GSF working group confirm
fit before you invest significant time, and lets the community surface
related work or methodology questions early.

### Step 3 — Working group review (specifications only)

For new contributions to `specifications/`, the relevant GSF working
group will review the proposal. Reference implementations in the
SCI specification family are reviewed by the SCI working group;
implementations of other specifications are reviewed by their
respective working groups.

Contributions to `tools/` typically don't require working-group review,
but the repository maintainers may ask for input from the relevant
working group if a tool encodes methodology choices that overlap with
a specification.

### Step 4 — Build the reference implementation

A reference implementation should meet these expectations:

- **Lives in its own subdirectory** at the appropriate path, named
  descriptively in lowercase kebab-case (`llm-inference`,
  `green-code-review`, `carbon-aware-scheduling`).
- **Includes a project-local `README.md`** explaining what it
  implements, how to run it, what's in scope, and what choices were
  made along the way.
- **Includes a `LICENSE` file.** MIT is preferred for consistency
  with other GSF code repositories.
- **Is runnable.** Anyone with a clone of the repository should be
  able to install dependencies and explore the example locally.
- **Includes sample data or recorded fixtures** where applicable, so
  the example can be tried without paid API access or proprietary
  infrastructure.
- **Documents its methodology and choices.** For specification
  implementations, this typically means a separate methodology
  document covering scope, assumptions, and citations. For tools, the
  README and inline comments are usually enough.
- **Includes tests** where applicable. The bar is "core behaviour can
  be exercised offline", not full coverage.

### Step 5 — Open a pull request

When the implementation is ready:

1. **Reference the proposal issue** in the pull request description.
2. **Include a checklist** confirming: tests pass (if applicable), no
   API keys committed, license file present, project README explains
   scope and how to run.
3. **Sign off on commits.** Use `git commit -s` to add a DCO sign-off.
4. **Be responsive to review feedback.** Reviews may request
   methodology clarifications, additional fixtures, documentation
   improvements, or structural changes to match repository conventions.

## Improving an existing reference implementation

For bug fixes, documentation improvements, or methodology refinements
to an existing project:

1. **For non-trivial changes**, open an issue first to discuss with the
   maintainers of that specific project. For typo fixes and obvious bug
   fixes, a direct pull request is fine.
2. **Fork the repository, create a feature branch, and open a pull
   request** targeting `main`.
3. **Run the affected project's tests** before submitting.
4. **Sign off on commits** with `git commit -s`.

Pull requests touching an existing project will be reviewed by that
project's maintainers, with the relevant working group included for
methodology-affecting changes to specification implementations.

## Multiple implementations of the same thing

Multiple implementations of the same specification, workload class, or
practice — taking different valid approaches — are explicitly welcome.
If someone has already contributed an SCI for AI implementation for LLM
inference and your team's approach differs in interesting ways (a
different measurement provider, a different functional unit choice, a
different language), please contribute it. Different valid approaches
are a feature of the collection, not a duplication.

When contributing an alternative implementation of something already
covered, choose a descriptive subdirectory name that reflects what's
distinctive about your approach (e.g., `llm-inference-batched`,
`llm-inference-rust`, `llm-inference-self-hosted`).

## Communication

- **GitHub Issues and Discussions** on this repository — for proposals,
  questions, and asynchronous review.
- **GSF working groups** — for methodology questions and specification
  scope. See the
  [Green Software Foundation website](https://greensoftware.foundation/)
  for working-group meeting schedules and joining instructions.

## License of contributions

By contributing to this repository, you agree that your contributions
will be licensed under the same license as the project to which they
apply — MIT for code, where applicable CC-BY-4.0 for documentation.

## Code of Conduct

All contributions, discussions, and reviews are governed by the GSF
Code of Conduct. Please read it before participating.

Thank you for helping build a resource that makes GSF specifications
and green-software practices concrete and usable.
