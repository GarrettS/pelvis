# DLC Prompt Editorial Review

Findings cover `prd/dlc-task-prompt.md` only. The review applies `/Users/garrettsmith/Documents/code-guidelines/editorial-rules.md` and gives replacement direction without rewriting the PRD.

## Instructional Leakage

`prd/dlc-task-prompt.md:1` stores agent instructions inside the artifact: use a separate editorial rules file and write paragraph prose. Move execution instructions into the task request or agent checklist. Keep the PRD focused on the rule, the violation trigger, and the expected check behavior.

`prd/dlc-task-prompt.md:5-9`, `prd/dlc-task-prompt.md:21`, `prd/dlc-task-prompt.md:23-29`, and `prd/dlc-task-prompt.md:31-35` describe phase control, approval order, file destinations, verification commands, and future doc edits. Move sequencing and approval gates into the implementation task. Keep the PRD as the product requirement for Data Load Consumption.

`prd/dlc-task-prompt.md:7` tells the agent how to size the current problem before drafting. Move the scan instruction into the task request. Keep the PRD requirement as a rule: DLC checks must report stale data loads where the parsed JSON value is assigned but never read.

`prd/dlc-task-prompt.md:19` tells the agent how to perform an editorial review. Move review procedure into the task request. Replace the PRD content with the acceptance condition that the DLC doctrine text passes the editorial rules before merge.

`prd/dlc-task-prompt.md:3` includes transient working-tree state: "That fix is uncommitted in the working tree." Remove process state from the PRD. State the durable precedent instead: an unused decoder data load kept a stale JSON file in the service-worker precache list.

## Prose Mechanics

`prd/dlc-task-prompt.md:3` uses a labeled goal sentence followed by a reduced example. Convert the goal into a paragraph with a topic sentence that names the rule boundary: data JSON references count as app dependencies only when app code reads the parsed JSON value.

`prd/dlc-task-prompt.md:5`, `prd/dlc-task-prompt.md:11`, `prd/dlc-task-prompt.md:23`, and `prd/dlc-task-prompt.md:31` use outline labels as the main structure. Replace phase labels with requirement paragraphs that state the runtime rule, checker behavior, service-worker interaction, and verification policy.

`prd/dlc-task-prompt.md:13-17` lists required proposal sections as fragments. Convert the list into paragraphs that define consumed data load, handled patterns, unsupported patterns, warning and failure policy, and `sw.js` interaction.

## Sound

`prd/dlc-task-prompt.md:3` says stale loads become false dependencies and create a false failure gate. The example names the mechanism, but the claim needs a direct rule statement. Replace the verdict with the mechanism: an unused JSON load forces fetch handling and precache validation even when no feature reads the parsed value.

`prd/dlc-task-prompt.md:27` says to strengthen the asset check. Replace the quality claim with a testable condition: a `data/*.json` path satisfies the service-worker precache check only when the DLC checker records a consumed app load for that path.

## Quality Words

`prd/dlc-task-prompt.md:1` uses "coherent" as a prose quality without a test. Replace it with the concrete editorial requirement: each paragraph opens with the claim it proves, and each following sentence supplies the mechanism, boundary, or consequence.

`prd/dlc-task-prompt.md:29` says "the new checks" without naming the commands. Replace it with the exact command names once Phase 2 chooses them, such as `node --test`, `npm run lint`, `npm run check:dlc`, and `bash bin/pre-commit-check.sh`.

`prd/dlc-task-prompt.md:35` says to fix "actual violations". Replace the judgment phrase with the review condition: fix only text that matches a stated editorial rule pattern; leave literal strings, quoted source text, and proper nouns unchanged.

## Rhetorical Metaphor

`prd/dlc-task-prompt.md:3` uses "failure gate" and "landing" as metaphors. Replace them with concrete failure paths: missing or malformed JSON blocks module initialization or fails precache validation despite the app never reading the parsed value.

## Exact Technical Nouns

`prd/dlc-task-prompt.md:5` uses "tooling" as a broad noun. Replace it with the file classes governed by the phase boundary, such as `bin/` scripts, `package.json`, ESLint config files, and project check scripts.

`prd/dlc-task-prompt.md:17` and `prd/dlc-task-prompt.md:27` use "asset checks" and "asset check" without naming the file or assertion. Replace them with `bin/pre-commit-check.sh` service-worker precache checks and orphan-asset checks.

## Requirement Words

`prd/dlc-task-prompt.md:11` says the proposal "must define" a list of sections. Replace task-control modal language with product behavior. The PRD should say that the DLC rule defines consumed data load, checker coverage, unsupported patterns, warning and failure policy, and service-worker interaction.
