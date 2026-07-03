# EchoAI Coding Evals

EchoAI ships a coding-agent eval harness (`evals/`) used as a release gate and
as public proof of quality-per-dollar. The core pitch: **frontier-class coding
results at a fraction of the cost** by running on inexpensive Chinese models.

## Running the suite

```bash
pnpm run build

# list tasks
node dist/cli.js eval list

# run a single task with a provider
DEEPSEEK_API_KEY=... node dist/cli.js eval run \
  --task eval-bugfix-divide-zero \
  --command "node dist/cli.js chat \"$ECHOAI_EVAL_PROMPT\" --provider deepseek"

# run the full suite for one model
node dist/cli.js eval run --all --agent echoai-deepseek \
  --command "node dist/cli.js chat \"$ECHOAI_EVAL_PROMPT\" --provider deepseek"

node dist/cli.js eval report
```

Each task copies a fixture, writes the prompt, runs the agent command, runs the
task check, and stores logs plus a diff under `evals/runs/<agent>/<timestamp>/`.

## Models to benchmark

Run the suite across the cheap Chinese providers and record pass rate + cost:

| Provider | Suggested model | `--provider` |
| --- | --- | --- |
| DeepSeek | `deepseek-chat` / `deepseek-reasoner` | `deepseek` |
| Kimi | `kimi-k2-0711-preview` | `kimi` |
| Zhipu GLM | `glm-4.6` (and free `glm-4-flash`) | `zhipu` |
| Qwen | `qwen3-coder-plus` | `qwen` |
| MiniMax | `MiniMax-M2` | `minimax` |

## Results table (fill in after running)

> Replace the placeholders below with real numbers from `eval report`. Do not
> publish numbers you have not reproduced.

| Model | Tasks passed | Pass rate | Avg cost / task | Notes |
| --- | --- | --- | --- | --- |
| deepseek-chat | _/20 | _% | $_ | |
| kimi-k2 | _/20 | _% | $_ | |
| glm-4.6 | _/20 | _% | $_ | |
| qwen3-coder-plus | _/20 | _% | $_ | |
| MiniMax-M2 | _/20 | _% | $_ | |

## Methodology notes

- Costs use the model's published per-token price at run time.
- The harness scores on test pass, diff scope, and required diff hints.
- For competitor comparison, pass the competitor CLI via `--command` with a
  different `--agent` label. EchoAI does not bundle competitor providers.
