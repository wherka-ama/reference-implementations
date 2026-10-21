---
description: Produce a token-optimized technical sustainability analysis plan and report grounded in the three GSF pillars (Energy Efficiency, Hardware Efficiency, Carbon Awareness).
---

# GSF Technical Sustainability Analysis Plan & Report

Using the compressed, low-SCI prompt structure from the GSF `sci-for-ai` reference implementation, produce an actionable technical sustainability analysis for the target system or query.

Output: concise bullets only, no filler or preamble.

## Part 1: Sustainability Analysis Plan

1. **GSF Pillar Prioritisation**: Identify which pillar(s) — **Energy Efficiency ($E$)**, **Hardware Efficiency ($M$)**, or **Carbon Awareness ($I$)** — offer the highest impact for this workload and why.
2. **Key Investigation Questions**: List 6–8 targeted engineering questions across algorithms, runtime efficiency, hardware utilization, autoscaling/scale-to-zero, carbon-aware execution, telemetry/measurement, framework choices, and cloud-vs-edge topology.
3. **Measurement & Tooling Baseline**: Identify concrete measurement tools and specifications to instrument the workload (e.g., SCI / SCI for AI, EcoLogits, CodeCarbon, Kepler, Cloud Carbon Footprint, Impact Framework).

## Part 2: Technical Recommendations Report

Organize concrete, code-backed recommendations under these exact sections:

### Energy Efficiency Strategies
### Hardware Resource Optimization
### Carbon-Aware Computing Practices
### Trade-Offs and Practical Considerations
### Implementation Roadmap (Quick Wins → Baseline Measurement → Architectural Changes)
