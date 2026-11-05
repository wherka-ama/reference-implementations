# Experiment 4: skill evaluation research and POC

## Objective and isolation

Branch `experiment/skill-evaluation`, independently based on
`03fd6047cfe30cd76514ae5355cee47947078950`. The original skill is unchanged.
This POC uses Node 22+ built-ins and the already installed Copilot, Devin, and
Kiro CLIs. There are no npm or Python dependencies to leak into other worktrees.
Every live invocation runs in its own temporary directory, removed afterward.

## Research and recommendation

Skills require multiple evaluation layers; YAML validation is not behavioral
correctness, and a plausible answer is not measured performance.

| Candidate | Strength | Limitation / decision |
| --- | --- | --- |
| Agent Skills reference validation | Official format and naming checks | Does not evaluate output quality or activation. Keep as a static gate. |
| Agent Skills evaluation workflow | Explicit with/without skill comparisons, independent sessions, timing, assertions, human review | A workflow, not a fully portable runner. Adopt its paired design. |
| promptfoo | Existing custom-script providers fit CLI-driven evaluations | Additional tooling and adaptation needed for trace parsing and account billing. Recommended growth path for a larger matrix. |
| DeepEval | Metrics, test-run integration, tracing and model-based rubrics | Larger dependency surface; LLM judging needs extra paid calls and human calibration. Consider when semantic judging becomes the bottleneck. |
| Small local runner (this POC) | No new dependencies, explicit CLI failure handling, public fixtures, transparent graders | Limited semantic grading; not a mature agent execution sandbox. Use to validate the experimental design, not as a new general framework. |

Recommendation: keep fast deterministic format/content gates in PR CI; run an
opt-in, budgeted paired behavior suite on approved CLIs; retain raw outputs and
use blinded human review before claiming improvements. Migrate the cases to
promptfoo custom providers if the matrix grows, rather than building a generic
framework here. Introduce LLM-as-judge only after calibrating against expert
labels and accounting for its additional requests and cost.

## POC contract

Three public, purpose-built cases cover SCI arithmetic, unsupported savings
claims, and redundant API-call review. The case file follows the Agent Skills
`skill_name` / `evals` structure with additional local grader metadata.
Each task runs with and without skill content for each CLI: 18 invocations per
repetition, 36 for two. Repetition two reverses arm order to reduce order bias.
Do not treat one repetition as statistically meaningful.

The treatment supplies the unchanged skill and relevant references inline.
The baseline receives exactly the same task without those documents. This
measures **inline-context output quality**, not native skill discovery,
activation precision/recall, reference-file retrieval, tool execution, or
Plugin 1.0 compatibility. A separate native-install matrix is required for those.

The CLIs have different system prompts and may choose different models.
Compare treatment against baseline *within* a pinned CLI/model before making
cross-provider claims. This initial POC records CLI versions but uses CLI model
defaults; exact model identity must be reviewed from traces. Future CI should
pin explicit model IDs in `commandFor`'s supported model argument.

## Run offline

```sh
npm test
npm run eval:plan
node evals/run.mjs --repetitions 2
```

These commands make no model calls. Synthetic good/bad objects in unit tests
test the grader implementation only; they are not recorded model outputs and
are never counted as skill-quality results.

## Run live only with approval and enforced account limits

The user approved Copilot, Devin, and Kiro and confirmed account-side limits of
**$10 total and at most 50 model requests**. No credentials are copied or stored
in this repository. Do not assume that future operators have the same limits.

```sh
node evals/run.mjs --live --account-limits-confirmed
# Or run one CLI without repeating all providers:
node evals/run.mjs --live --account-limits-confirmed --providers copilot
```

The CLI invocation ceiling is separately enforced across runs in the local
`evaluation-results/budget.json` ledger. Reservations are persisted before
launch; failures are not refunded. A lock blocks concurrent writers.
**One invocation can make multiple model requests.** The local ledger cannot
enforce dollars or internal calls; the confirmed account-side controls are the
authority. Copilot's own AI-credit ceiling is soft and is not a USD hard cap.
Deleting the ledger does not reset provider spending.

Fresh CWDs and restricted tools reduce contamination, but are **not an OS
sandbox**. Existing user profiles, installed global plugins, organization
policy, and CLI startup MCP behavior may still affect runs. Do not use a profile
containing private customizations for public-provider benchmarking. For a strict
causal study, authenticate each CLI in a dedicated container/profile, disable
global plugins/MCPs, and verify the baseline has no skill context. The POC does
not copy the user's credentials or modify their global configuration.

## Results and grading

`evaluation-results/<timestamp>/report.json` retains raw stdout/stderr, case and
arm, prompt hash, CLI version, source revision, wall latency, individual checks,
and per-provider/arm summaries. Results are ignored by Git; inspect before
sharing. Authentication/timeout/nonzero CLI errors are explicit, not successful
empty results. A transport failure stops the run to conserve budget.

Only SCI arithmetic and exact requested units have fully objective semantic
checks. Review findings and measurement plans have structural checks and still
require human review: meaningful evidence, correct batching/deduplication,
preserved output order/duplicates, freshness and memory trade-offs, workload
boundaries, and no fabricated measurements in prose. A structurally passing
answer can be wrong. No regex-only score is presented as proof of code quality.
No generated code is executed on the shared host.

Unknown token counts, billed dollars, and energy are `null`, never zero or
estimated from answer length. Wall time includes CLI startup/network overhead;
it is not isolated model inference time. These results cannot establish carbon
or energy reduction.

## Proposed adoption gates

1. PR gate: format validation, broken resource/link checks, unchanged baseline
   fixtures, and deterministic grader tests.
2. Behavior gate: no arithmetic or fabricated-savings failures on all supported
   pinned CLI/model pairs; human reviewers accept domain findings.
3. Before release: repeated paired trials (at least five after a separate budget
   approval), mean pass rate and confidence intervals, latency distribution,
   known token/cost data, and no material regression versus the prior skill.
4. Native activation: positive, paraphrased, ambiguous, and unrelated prompts,
   with skill-load traces and explicit precision/recall measurements.
5. Code-generation tasks: test produced artifacts in a restricted container,
   including output correctness, duplicate/order preservation, bounded maximum
   concurrency, API failure behavior, and measured request counts.

## Revert / cleanup

After reviewing and preserving desired reports, the branch can be retained
without merging. The results directory is ignored, so inspect it before removing
the clean worktree:

```sh
git status --short --ignored
git worktree remove ../reference-implementations-skill-evaluation
```

No automated cleanup removes authenticated CLI profiles or any original
repository files. Revert experiment commits if the POC is later adopted.

## Sources (accessed 2026-11-05)

- [Agent Skills specification and reference validator](https://agentskills.io/specification)
- [Agent Skills evaluation workflow](https://agentskills.io/skill-creation/evaluating-skills)
- [Agent evaluation methodology and grader trade-offs](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- [promptfoo custom script providers](https://www.promptfoo.dev/docs/providers/custom-script/)
- [DeepEval quickstart](https://deepeval.com/docs/getting-started)
- [Copilot CLI documentation](https://docs.github.com/copilot/how-tos/copilot-cli)
- [Devin CLI command reference](https://docs.devin.ai/cli/reference/commands.md)
- [Devin permissions](https://docs.devin.ai/cli/reference/permissions.md)
- [Kiro agent configuration](https://kiro.dev/docs/custom-agents/configuration-reference/)

Installed CLI help was checked as well; current website documentation can differ
from the installed version. Actual execution outcomes are recorded below.
