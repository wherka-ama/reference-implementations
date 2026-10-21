---
description: Generate new code or system designs with Green Software Foundation (GSF) patterns baked in by default, complete with an SCI-mapped Green Notes block and trade-off analysis.
---

# Green Software Code Generation

Generate code for the requested task with **Green Software Foundation (GSF)** patterns and **Software Carbon Intensity (`SCI = (E × I + M) / R`)** optimizations applied by default.

## Generation Procedure

1. **Classify the workload** (`web frontend`, `cloud backend`, `data pipeline`, `AI/ML inference`, or `agentic AI orchestration`).
2. **Select the 2–5 highest-leverage green patterns** that genuinely fit the workload context:
   - *Backend / Data*: async non-blocking I/O, bounded pagination & column projection, `Cache-Control` / TTL caching, compressed storage/payloads (gzip/Brotli/Parquet), accept-then-queue for deferrable work.
   - *Web Frontend*: modern image formats (`<picture>` with AVIF/WebP), `loading="lazy"`, responsive `srcset`, minimal DOM depth, debounced network calls.
   - *AI / Agentic*: model routing by subtask complexity, bounded `max_iterations` and tool-loop detection, capped retry budgets with exponential backoff on transient errors only, prompt prefix caching, concise `max_tokens` / structured outputs.
3. **Write clean, idiomatic code** with those patterns built in from the start.
4. **Append a `Green Notes` section** mapping each applied pattern to its SCI term (`E`, `M`, `R`, or `enables I`) with its canonical GSF pattern URL, and explicitly note any patterns deliberately skipped due to trade-offs.

## Required Output Format

```markdown
<generated code>

---
### Green Notes
- **<Pattern name>** (reduces <E | M | R>) — <one-sentence explanation for this workload>
  https://patterns.greensoftware.foundation/<path>

**Trade-offs considered:** <list any patterns intentionally not applied and the engineering rationale>
```
