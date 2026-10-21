---
description: Green Software Foundation (GSF) patterns and Software Carbon Intensity (SCI) standards for sustainable code generation, refactoring, and code review across web, cloud, data, AI/ML, and agentic workloads.
applyTo: "**"
---

# Green Software Engineering Standards (GSF & SCI)

Generate and review code against the **Green Software Foundation (GSF) Patterns Catalog** and the **Software Carbon Intensity (SCI)** specification (`ISO/IEC 21031:2024`).

## 1. The SCI Backbone

Every architectural or code-level recommendation must map to the SCI formula:

$$\text{SCI} = \frac{(E \times I) + M}{R}$$

- **$E$ (Energy consumed, kWh)**: Directly reduced by code efficiency — payload compression, caching, async I/O, smaller models, fewer network/LLM calls, lazy loading.
- **$I$ (Carbon intensity, gCO2eq/kWh)**: Determined by deployment region and time. Code *enables* $I$ reductions via deferrable queues and batching, while deployment/ops chooses cleaner regions or windows.
- **$M$ (Embodied hardware emissions, gCO2eq)**: Reduced by right-sizing instances, stateless container density, and scale-to-zero serverless architectures.
- **$R$ (Functional unit)**: The denominator (per request, per user, per inference). Improved by sharing work across requests (SSR for high-traffic pages, batch processing, pre-trained model reuse).

Organize guidance under the three GSF pillars:
1. **Energy Efficiency** (reduces $E$)
2. **Hardware Efficiency** (reduces $M$)
3. **Carbon Awareness** (reduces $I$)

## 2. Honesty & Trade-off Rules (Non-Negotiable)

1. **Never invent quantitative percentages**: Do not claim "saves 47% energy" without measured telemetry. Use directional language ("reduces $E$ by eliminating N+1 network round-trips").
2. **Surface trade-offs explicitly**: Name latency, staleness, cold-start, or client-device embodied carbon shifts whenever recommending a pattern.
3. **Refuse patterns that conflict with context**: Do not batch real-time low-latency paths; do not add SSR to a 10-user internal admin tool; do not weaken TLS where the threat model forbids it.
4. **Distinguish code vs. operations**: Never claim a code change directly changes grid carbon intensity ($I$); state that it enables carbon-aware scheduling or regional placement.
5. **Cite canonical GSF patterns**: Reference `https://patterns.greensoftware.foundation/<path>` where applicable.

## 3. Core Pattern Checklist by Domain

### Data & Network Efficiency
- Use pagination, projection, and sparse fieldsets instead of `SELECT *` or full-table responses (`/development/data-handling/reduce-transmitted-data`).
- Compress transmitted payloads with gzip/Brotli and stored analytical data with Parquet/Avro/zstd (`/development/data-handling/compress-transmitted-data`, `/development/data-handling/compress-stored-data`).
- Cache static and repeatable reads with explicit `Cache-Control` / TTL policies (`/development/data-handling/cache-static-data`).
- Use asynchronous, non-blocking network and database I/O (`/development/use-async-instead-of-sync`).

### Web & Media Efficiency
- Serve modern image formats (`AVIF`, `WebP`) with responsive `srcset`/`sizes` and `loading="lazy"` for offscreen media (`/development/media-and-code-efficiency/serve-images-in-modern-formats`, `/development/media-and-code-efficiency/defer-offscreen-images`).
- Replace animated GIFs with muted looping `<video>` (`MP4`/`WebM`) (`/development/media-and-code-efficiency/deprecate-gifs`).
- Remove unused CSS, minify assets without shipping production source maps, and avoid excessive DOM depth (`/development/web-performance/minify-web-assets`, `/development/web-performance/avoid-excessive-dom-size`).

### Cloud Architecture & Topology
- Externalize state so services can scale horizontally and pack densely in containers (`/architecture/system-topology/implement-stateless-design`, `/architecture/system-topology/containerize-your-workload-where-applicable`).
- Queue non-urgent background processing to smooth peak hardware provisioning and enable carbon-aware time-shifting (`/architecture/system-topology/queue-non-urgent-requests`).
- Co-locate chatty services to reduce cross-AZ/region traversal (`/architecture/system-topology/reduce-network-traversal-between-VMs`).

### AI/ML & Agentic Workloads
- Leverage pre-trained models, LoRA/adapters, and quantization (`INT8`/`INT4`/`FP8`) paired with accuracy evaluation (`/development/pre-trained-transfer-learning`, `/architecture/compress-ml-models-for-inference`).
- Route subtasks to right-sized models (small models for classification/extraction/routing; frontier models for complex synthesis).
- Bound agentic loops (`max_iterations`), cap retry budgets with exponential backoff on transient errors only, detect repeated `(tool_name, args)` calls, and enable prompt/response caching.
