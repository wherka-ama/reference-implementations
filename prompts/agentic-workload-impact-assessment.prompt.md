---
description: Analyze single-agent or multi-agent LLM architectures for compounding context loops and recommend ordered green software reduction levers across cost, energy, carbon, and water.
---

# Agentic AI Workload Impact & Reduction Lever Assessment

Evaluate the target agentic AI system (single-agent or multi-agent architecture) using the methodology from the GSF `agentic-ai-impact-explorer` and `sci-for-ai` reference implementations.

## Assessment Steps

1. **Map the Context Loop Shape**:
   - Identify each agent role/stage (e.g., Router, Planner, Worker Loop, Tool Executor, Verifier/Guardrail).
   - Estimate the standing prompt size (system instructions + tool schemas), expected turn count ($T$), tool return payload growth per turn, and retry behavior.
   - Highlight where quadratic $O(T^2)$ transcript re-processing or unbounded loops inflate input/output tokens.

2. **Evaluate Ordered Green Reduction Levers**:
   Assess each of the 8 reduction levers in deployment order, specifying how to implement it in the user's framework (e.g., LangGraph, OpenAI Agents SDK, Google ADK, CrewAI, or custom SDK) and which SCI term ($E, I, M, R$) it improves:
   1. **Per-role model routing** (small models for routing/extraction; frontier models only for synthesis)
   2. **Reasoning & output token budgets** (`max_tokens`, concise structured outputs)
   3. **Summarise-and-retrieve memory / tool-output truncation** (breaking transcript growth)
   4. **Provider prompt / prefix caching** (stabilizing system + tool prefixes across turns)
   5. **Bounded loop depth & tool-call loop detection** (`max_iterations` and `(tool, args)` hashing)
   6. **Hardened retry budgets** (bounded exponential backoff on transient errors only)
   7. **Batching deferrable workloads** (asynchronous execution for non-interactive runs)
   8. **Carbon-aware regional & temporal placement** (low-$I$ regions and time windows)

3. **Recommend Telemetry & MCP Attribution**:
   - Specify how to track `SCI per request` ($R = 1\text{ agent run}$) and how MCP tools called by the agent can disclose and attribute their footprint via `foundation.greensoftware/sustainability`.
