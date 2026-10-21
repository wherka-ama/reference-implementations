# SCI for AI & Sustainable Agentic Workloads Collection

Agentic primitives and Model Context Protocol (MCP) server configuration derived from the Green Software Foundation's `sci-for-ai`, `mcp-sci`, and `agentic-ai-impact-explorer` reference implementations.

## Included Primitives

- **Skill (`skills/sci-for-ai/SKILL.md`)**: End-to-end guidance for applying the SCI for AI specification to LLM inference pipelines, prompt compression, MCP sustainability telemetry (`foundation.greensoftware/sustainability`), and multi-agent context loop optimization.
- **Instruction (`instructions/sci-for-ai-methodology.instructions.md`)**: Standards for labeling measured vs. estimated energy ($E$), location-based grid intensity ($I$), embodied emissions ($M$), functional units ($R$), and MCP `_meta` disclosures/attributions.
- **Prompts**:
  - `prompts/sustainability-analysis-plan.prompt.md` — Token-optimized technical sustainability analysis planner and report generator.
  - `prompts/agentic-workload-impact-assessment.prompt.md` — Compounding context loop and ordered green reduction lever evaluator for single-agent and multi-agent architectures.
- **Agent (`agents/sci-ai-architect.agent.md`)**: Specialist AI Sustainability Architect agent.
- **MCP Server (`mcp-sci`)**: Demo MCP server exposing `foundation.greensoftware/sustainability` disclosures on `tools/list` and per-call SCI attributions on `tools/call`.
