# Agentic AI Workload Impact & Reduction Levers

Derived from the GSF `agentic-ai-impact-explorer` and `green-code-skill` reference implementations.

## 1. The Compounding Context Loop

Unlike a single-turn LLM call, an agentic system runs across multiple turns ($T$) and often across multiple specialized roles (router, planner, worker loop with tool invocations, verifier/guardrail).

At each turn $t \in \{1, \dots, T\}$, the model re-processes:
1. **Standing prompt** ($S$): system instructions, persona definitions, and tool schemas.
2. **Accumulated transcript** ($\sum_{k < t} (I_k + O_k + TR_k)$): user inputs, prior assistant reasoning/outputs, and raw tool return payloads ($TR_k$).

Because the transcript grows at every step, total input tokens scale quadratically with turn count ($O(T^2)$) unless bounded. Retries and tool-call loops multiply this footprint further.

## 2. Single-Agent vs. Multi-Agent (Per-Role) Architectures

- **Single-Agent Architecture**: One frontier model handles routing, tool selection, data extraction, and final synthesis, carrying the full standing prompt and tool catalog on every turn.
- **Multi-Agent (Staged Role) Architecture**: Decomposes the workflow into stages with distinct model tiers and token profiles:
  - **Router / Classifier**: Small/nano model tier, 1 turn, minimal prompt.
  - **Worker Loop**: Mid-tier or specialized model, bounded turns, scoped tool schemas.
  - **Synthesis / Guardrail**: Frontier or specialized model only where complex reasoning or safety verification is required.

## 3. Ordered Reduction Levers (Mapped to GSF Patterns)

Apply these levers in the order a production engineering team would adopt them:

1. **Right-size models per role (Model Routing)**
   - *Mechanism*: Route classification, extraction, and simple tool dispatch to smaller models; reserve frontier models for complex synthesis.
   - *SCI Impact*: Directly reduces $E$ (5–20× per routed step) and $M$ (smaller accelerator footprint).
2. **Trim reasoning budgets & output tokens**
   - *Mechanism*: Cap thinking/reasoning token budgets on routine steps, set `max_tokens`, and require concise structured or bulleted outputs.
   - *SCI Impact*: Reduces $E$ heavily because autoregressive output tokens consume significantly more energy per token than parallel input tokens.
3. **Summarise-and-retrieve memory / transcript pruning**
   - *Mechanism*: Truncate raw tool outputs, summarize older turns, or store large payloads externally and retrieve slices on demand instead of re-sending the full transcript every turn.
   - *SCI Impact*: Breaks quadratic $O(T^2)$ input token growth, reducing $E$.
4. **Enable provider prefix / prompt caching**
   - *Mechanism*: Keep system prompts, tool definitions, and static RAG context in a stable prefix so KV-cache state is reused across turns.
   - *SCI Impact*: Reduces prefill compute energy ($E$) on every turn after turn 1.
5. **Bound planning depth & detect tool-call loops**
   - *Mechanism*: Enforce a strict `max_iterations` (typically 5–10) and hash `(tool_name, normalized_args)` to break immediately on repeated or oscillating tool calls.
   - *SCI Impact*: Eliminates runaway tail emissions ($E$ and $M$).
6. **Harden retry budgets**
   - *Mechanism*: Cap retries (3–5 max), use exponential backoff with jitter, and never retry deterministic errors (`4xx`, schema validation failures without prompt repair).
   - *SCI Impact*: Prevents retry storms from multiplying $E$.
7. **Batch non-urgent agent runs**
   - *Mechanism*: Queue asynchronous/background agent workloads (e.g., nightly triage, report generation, dataset labeling) to run in higher-utilization batches.
   - *SCI Impact*: Improves hardware utilization ($M$) and enables time-shifting ($I$).
8. **Carbon-aware regional & temporal placement**
   - *Mechanism*: Deploy inference endpoints and schedule batch agent workloads in low-carbon-intensity grids (e.g., `europe-north1`, `us-west1`) or cleaner time windows.
   - *SCI Impact*: Directly reduces location-based grid carbon intensity ($I$).
