---
name: sci-for-ai
description: Apply the Green Software Foundation SCI for AI specification (extending ISO/IEC 21031:2024) to measure, model, and reduce the carbon, energy, and cost footprint of LLM inference pipelines, MCP servers, and multi-agent AI workloads. Use when instrumenting LLM calls, defining functional units and measurement boundaries, implementing the foundation.greensoftware/sustainability MCP extension, optimizing prompt token profiles, or evaluating agentic AI reduction levers.
metadata:
  license: MIT
  version: 1.0.0
  author: Green Software Foundation
allowed-tools:
  - read_file
  - grep_search
  - semantic_search
  - list_dir
  - create_file
  - replace_string_in_file
  - run_in_terminal
---

# SCI for AI & Sustainable Agentic Workloads Skill

Guide the design, instrumentation, prompt optimization, and protocol integration of AI and LLM workloads using the Green Software Foundation **SCI for AI** specification ([ISO/IEC 21031:2024](https://www.iso.org/standard/86612.html) extension), the **SCI over MCP** sustainability extension, and **Agentic AI Impact** modeling.

## When to activate

Activate this skill when the user wants to:
- Measure or estimate the Software Carbon Intensity (SCI) of an LLM inference pipeline or AI service.
- Define functional units ($R$), measurement boundaries (provider vs. consumer persona, inference vs. training phase), or location-based carbon intensity ($I$) for AI workloads.
- Optimize prompts to reduce input/output token consumption while preserving output quality.
- Expose or consume sustainability telemetry over the Model Context Protocol (MCP) using the `foundation.greensoftware/sustainability` extension (`tools/list` disclosure and `tools/call` attribution).
- Analyze or reduce the compounding context loop and token/energy/carbon footprint of single-agent or multi-agent systems.

## Core SCI for AI Formula

$$\text{SCI} = \frac{(E \times I) + M}{R}$$

| Symbol | Meaning | Typical Units | Implementation Guidance |
|---|---|---|---|
| **$E$** | Energy consumed by the AI workload | `kWh` | Prefer **measured** figures via instrumentation libraries (e.g., EcoLogits); fall back to calibrated **estimated** per-token profiles (accounting for higher sequential decoding energy on output tokens vs. parallel input tokens). Always label values as `measured` or `estimated`. |
| **$I$** | Carbon intensity of electricity | `kgCO2e/kWh` or `gCO2e/kWh` | Use **location-based** grid carbon intensity for the deployment region (e.g., `europe-north1` ~0.058, `us-west1` ~0.078, `us-central1` ~0.413, `world-average` ~0.475 kgCO2e/kWh). |
| **$M$** | Embodied emissions amortized per unit of work | `kgCO2e` or `gCO2e` | Prefer `provider-reported` figures; otherwise use the standard `12%` of operational emissions heuristic and explicitly record the basis (`estimated (12% of operational)`). |
| **$R$** | Functional unit of useful work | `per request`, `per call`, `per token` | Choose a user-meaningful headline unit (such as `1 request` for a complete multi-step report or user query) so comparisons stay valid across prompt, model, or architecture changes. |

## Reference files in this skill

Load the matching reference file before implementing or reviewing:

| Reference File | Purpose |
|---|---|
| `references/sci-methodology.md` | Full SCI for AI methodology for LLM inference: computing $E, I, M, R$, per-call measurement fields, scale projection, and prompt-compression rules (-40% to -60% input tokens, -30% to -50% output tokens). |
| `references/mcp-sustainability-extension.md` | MCP `foundation.greensoftware/sustainability` extension shape for `server/discover`, static `tools/list` `_meta` disclosure, and opt-in `tools/call` `_meta` per-call attribution. |
| `references/agentic-impact-levers.md` | Compounding context loop mechanics in single-agent and multi-agent architectures and ordered reduction levers mapped to mainstream agent frameworks. |

## Workflows

### 1. Instrumenting an LLM Inference Pipeline
1. Consult `references/sci-methodology.md`.
2. Define the primary functional unit $R$ (e.g., `1 request` across all internal pipeline phases) alongside secondary diagnostic units (`1 call`, `1 token`).
3. Record per-call telemetry (`input_tokens`, `output_tokens`, `energy_kwh`, `energy_source` as `measured` or `estimated`, `carbon_intensity` by region, `operational_kg`, `embodied_kg`, `total_emissions_kg`, and `cost_usd`).
4. Aggregate across phases and project to operational scale (daily, monthly, annual requests).

### 2. Compressing & Optimizing Prompts for Lower SCI
Apply the four GSF reference prompt-optimization transformations:
1. **Remove filler instructions** — replace verbose prose with concise one-line directives.
2. **Compress example blocks** — retain only the single most representative example.
3. **Specify concise output format** — e.g., *"Output: bullets only, no preamble"* (reduces higher-energy output tokens by 20–40%).
4. **Replace structural prose with section headings** — let headings define structure without paragraph explanations.

### 3. Adding SCI Telemetry to an MCP Server
1. Consult `references/mcp-sustainability-extension.md`.
2. Advertise `foundation.greensoftware/sustainability` in `server/discover` capabilities.
3. Attach static `Disclosure` metadata (`methodology`, `functionalUnit`, `boundary`, `typical`) under `_meta["foundation.greensoftware/sustainability"]` on `tools/list` with a `CacheHint` TTL.
4. On `tools/call`, when the client declares the extension capability, attach per-call `Attribution` (`functionalUnit`, `boundary`, `energy`, `carbonIntensity`, `emissions`, `sci`, `details`) in `_meta["foundation.greensoftware/sustainability"]` while leaving ordinary clients unchanged.

### 4. Auditing Agentic AI Context Loops
1. Consult `references/agentic-impact-levers.md`.
2. Model transcript growth across turns ($T$ turns re-processing standing prompt + accumulated tool outputs and history).
3. Apply reduction levers in order: right-size models per role (router vs. worker vs. guardrail), cap reasoning budgets, summarise-and-retrieve memory, enable prefix caching, bound loop iterations, cap retry budgets, batch deferrable runs, and use carbon-aware regional placement.
