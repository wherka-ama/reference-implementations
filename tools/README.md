# Tools

This directory holds developer-facing tools that encode green-software
practices into working software — agent skills, code-review assistants,
linters, GitHub Actions, CLI utilities, dashboards, and similar working
examples that help teams build greener software day to day.

Each tool here demonstrates one possible way to encode a particular
practice or workflow. They are educational starting points, intended
to be read, run, and adapted to each team's own context. Alternative
implementations taking different valid approaches are welcome.

## Structure

```
tools/
├── gsf/                   Tools maintained by the Green Software Foundation
│   └── <tool-name>/
└── community/             Tools contributed and maintained by the community
    └── <tool-name>/
```

Within each maintainer subdirectory, each tool gets its own folder
named descriptively in lowercase kebab-case
(`green-code-review`, `carbon-aware-scheduler-example`,
`energy-aware-linter`).

## What can be a tool here?

A wide range of contributions are welcome, including:

- **Agent skills** that help developers reason about the carbon
  implications of code they're writing, designs they're reviewing,
  or systems they're operating.
- **Code-review assistants** — linters, GitHub Actions, IDE
  extensions — that flag patterns with notable energy or carbon
  implications.
- **Architectural pattern examples** — working code demonstrating
  carbon-aware scheduling, request batching, efficient caching,
  region selection logic.
- **Dashboards and reporting tools** that surface carbon, energy, or
  cost data in formats useful to engineering teams.
- **Developer workflows** that incorporate sustainability
  considerations into design reviews, on-call rotations, or
  deployment processes.

The common thread is that each tool is a working, runnable example
that practitioners can read, run, and adapt to their own context.

## Available tools

### Maintained by GSF (`gsf/`)

- **[green-code-skill](./gsf/green-code-skill/)** — Agent skill and portable instructions applying 40+ GSF Development, Architecture, AI/ML, and Agentic AI patterns mapped to the SCI formula during code generation and code review.
- **[agentic-ai-impact-explorer](./gsf/agentic-ai-impact-explorer/)** — Interactive simulator for cost, energy, carbon, and water impact of single-agent and multi-agent LLM workloads with reduction levers mapped to green software patterns.
- **[mcp-sci](./gsf/mcp-sci/)** — Reference implementation carrying SCI for AI disclosures and per-call attributions over the Model Context Protocol (`foundation.greensoftware/sustainability`).

### Maintained by the community (`community/`)

No community tools have been contributed yet. Contributions are
welcome — see [CONTRIBUTING.md](../CONTRIBUTING.md) for the process.

## A note on scope

Tools in this directory should focus on **developer-facing software**
that helps teams build, review, deploy, or operate greener systems.
Implementations of GSF measurement specifications applied to specific
workload classes belong under [`specifications/`](../specifications/)
instead.

If a tool both implements a specification and provides a developer-
facing interface (for example, an agent skill that internally uses
SCI for AI to estimate the carbon of generated code), it can live in
either place depending on its primary contribution. The tool's README
can cross-reference the specification it depends on.

## Contributing

See the top-level [CONTRIBUTING.md](../CONTRIBUTING.md) for the
contribution process.
