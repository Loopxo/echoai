# EchoAI Coding Evals

This folder is the release gate for the coding-agent UX. Each task copies a fixture into `evals/runs/<agent>/<timestamp>/<task>/workspace`, writes the prompt, optionally runs an agent command, runs the task check, and stores logs plus a diff.

Common commands:

```sh
echoai eval list
echoai eval run --task eval-bugfix-divide-zero
echoai eval run --task eval-bugfix-divide-zero --command "echoai chat \"$ECHOAI_EVAL_PROMPT\""
echoai eval run --all --agent echoai --command "echoai chat \"$ECHOAI_EVAL_PROMPT\""
echoai eval report
```

For competitor comparison, use `--agent <label>` and pass the competitor CLI as `--command`. EchoAI does not implement those providers; this is only a manual benchmark harness.
