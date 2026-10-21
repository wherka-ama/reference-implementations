---
description: Audit existing code or system designs against Green Software Foundation (GSF) patterns and the Software Carbon Intensity (SCI) specification, producing severity-ranked findings with canonical pattern links.
---

# Green Software Code & Architecture Review

Review the provided code, configuration, or architecture design against the **Green Software Foundation (GSF) Patterns Catalog** and **SCI (`(E × I) + M per R`)** principles.

## Review Procedure

1. **Read the code or design completely** before flagging issues to avoid false positives.
2. **Identify the workload type** (`web`, `cloud backend`, `data pipeline`, `AI/ML`, `agentic AI`, or `mixed`).
3. **Scan for anti-patterns** across:
   - *Development*: blocking/synchronous I/O in loops, over-fetching (`SELECT *`, missing pagination), uncompressed payloads/storage, missing `Cache-Control` or TTL caches, unoptimized images/GIFs, excessive DOM size.
   - *Architecture*: stateful session pinning preventing horizontal scale, always-on oversized compute for bursty workloads, synchronous processing of deferrable tasks, chatty cross-AZ/region calls.
   - *AI/ML & Agentic AI*: frontier models used for trivial routing/extraction steps, unbounded agent loops (`max_iterations` missing), uncapped retries or retrying non-transient errors, missing prompt/response caching, unpruned compounding transcripts.
4. **Rank findings by severity** (`High` → `Medium` → `Low`):
   - **High**: Ongoing, scaled emissions impact on every request, user, or loop iteration.
   - **Medium**: Meaningful but bounded impact, or requires non-trivial refactoring.
   - **Low**: Minor or highly context-dependent optimization.
5. **Follow strict honesty rules**: Never invent quantitative percentages without measurement data. Use directional SCI impact statements (`reduces E`, `reduces M`, `improves R`, `enables I reduction`) and surface trade-offs explicitly.

## Required Output Format

```markdown
## Green Software Review

**Workload type:** <web | cloud backend | data pipeline | AI/ML | agentic AI | mixed>
**Files reviewed:** <list>

### Findings

#### [High | Medium | Low] <Pattern name>
- **Location:** <file:line or symbol name>
- **Issue:** <1–2 sentences describing the inefficiency>
- **Pattern:** <Canonical GSF pattern name and https://patterns.greensoftware.foundation/... URL>
- **SCI impact:** <Which SCI term (E, M, R, or enables I) and qualitative magnitude>
- **Trade-offs:** <Latency, staleness, complexity, or client-device considerations>
- **Suggested fix:** <Concrete refactoring code snippet or architectural change>

### Patterns checked and passed
- <Patterns the code already implements well>

### Out of scope (need ops/architecture input)
- <Deployment region carbon intensity (I), hardware instance types, or scheduling windows that cannot be verified from code alone>
```
