# Green Software Coding & Review Collection

Curated agentic primitives from the [Green Software Foundation (GSF) Reference Implementations](https://github.com/Green-Software-Foundation/reference-implementations) for generating and reviewing software against 40+ GSF patterns and the Software Carbon Intensity (SCI) specification (`ISO/IEC 21031:2024`).

## Included Primitives

- **Skill (`skills/green-code-skill/SKILL.md`)**: Comprehensive multi-file skill covering 23 Development patterns, 17 Architecture patterns, 10 AI/ML patterns, and 10 Agentic AI workload patterns, with progressive disclosure reference files (`patterns-development.md`, `patterns-architecture.md`, `patterns-ai-ml.md`, `sci-formula.md`, `trade-offs.md`).
- **Instruction (`instructions/green-software-standards.instructions.md`)**: Always-on coding and architectural standards grounded in $\text{SCI} = \frac{(E \times I) + M}{R}$ and non-negotiable engineering trade-off honesty rules.
- **Prompts**:
  - `prompts/green-code-review.prompt.md` — Structured severity-ranked Green Software Review workflow.
  - `prompts/green-code-generation.prompt.md` — Green-by-default code generation with an SCI-mapped `Green Notes` block.
- **Agent (`agents/green-software-advisor.agent.md`)**: Dedicated Green Software Advisor persona for interactive design, refactoring, and review sessions.
