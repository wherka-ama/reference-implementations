---
description: SCI for AI measurement conventions, prompt compression rules, and MCP sustainability extension guidelines for Python and AI/LLM services.
applyTo: "**/*.{py,ts,js,json,yml,yaml,md}"
---

# SCI for AI & MCP Sustainability Methodology Guidelines

Follow these guidelines when implementing or reviewing AI/LLM inference measurement, prompt pipelines, or Model Context Protocol (MCP) sustainability extensions based on the GSF `sci-for-ai` and `mcp-sci` reference implementations.

## 1. SCI for AI Calculation & Labeling Rules

1. **Formula**: Compute $\text{SCI} = \frac{(E \times I) + M}{R}$ where:
   - $\text{operational\_emissions} = E \times I$
   - $\text{total\_emissions} = \text{operational\_emissions} + M$
2. **Transparency of Data Basis**:
   - Every energy figure ($E$) must be explicitly labeled `"measured"` (e.g., from an instrumentation library such as EcoLogits) or `"estimated"` (from a calibrated per-token profile).
   - Model output tokens separately from input tokens when estimating energy, since sequential autoregressive decoding is significantly more energy-intensive per token than parallel prompt prefill.
   - Label carbon intensity ($I$) with the deployment `region` and `"location-based"` basis.
   - Label embodied emissions ($M$) as `"provider-reported"` when available, or `"estimated (12% of operational)"` when using the fallback heuristic.
3. **Functional Unit Consistency**:
   - Use a stable, user-facing functional unit $R$ (such as `R = 1 request` for an end-to-end multi-step pipeline) when comparing baseline vs. optimized implementations, alongside diagnostic per-call and per-token metrics.

## 2. Prompt Optimization Rules for Lower SCI

When writing or refactoring prompts in AI pipelines:
- Remove filler directives and repetitive instructions.
- Keep only the single most representative few-shot example block when examples are needed.
- Constrain output verbosity explicitly (e.g., `"Output: bullets only, no preamble"`) to reduce expensive output token generation.
- Use section headings directly instead of multi-sentence structural descriptions.

## 3. MCP Sustainability Extension (`foundation.greensoftware/sustainability`)

When exposing SCI for AI metrics from an MCP server:
1. **Separation of Concerns**: Never mix sustainability metadata into business tool output text; always attach it under `_meta["foundation.greensoftware/sustainability"]`.
2. **Static Disclosure on `tools/list`**:
   - Provide `methodology` (`SCI-for-AI`, base `SCI (ISO/IEC 21031:2024)`), `functionalUnit` (`name`, `description`), `boundary` (`persona`, `phase`, `description`, `includes`, `excludes`), and `typical` (`sci`, `energy`, `basis`).
   - Add a `CacheHint` on `tools/list` so clients cache static disclosures rather than re-fetching on every call.
3. **Opt-In Attribution on `tools/call`**:
   - Attach per-call attribution (`functionalUnit`, `boundary`, `energy`, `carbonIntensity`, `emissions`, `sci`, `details`) **only** when the MCP client declared `foundation.greensoftware/sustainability` in its capabilities.
   - Plain MCP clients must receive unchanged tool responses with zero extra payload overhead.
