# PRI Pelvis Restoration Study App — Project Context

## Live App
https://dulcet-crostata-b5cd49.netlify.app/

## What This Is
A personal interactive study tool I built to learn the Postural Restoration Institute (PRI) Pelvis Restoration course material and pass the certification exam. It will also be shared with classmates after the exam.

## Project Files
- `pri-unified.html` — the app. Single HTML file, all data and logic inline.
- `CC-BUILD-SPEC.md` — technical spec for Claude Code. Feature inventory, code standards, build order. Claude Code reads this.
- `triage-v-01.txt` — known issues and feature requests. Drives current priorities.
- `Pelvis Restoration 2026 Complete Manual.md` — the course manual. **Authoritative source for all PRI content.** If the app data contradicts this file, the manual wins. If Claude's training data contradicts this file, the manual wins.
- `LEARN-PRI.md` — supplementary course knowledge file.

## Goals

### Personal goals
1. Pass the PRI Pelvis Restoration exam — March 9, 2026 (two weeks away)
2. Actually understand the material, not just memorize it

### What the app must do to achieve those goals
1. Translate PRI terminology into standard anatomical language so the mechanics are clear
2. Drill terminology and concepts through interactive tools — quizzes, scenarios, flashcards
3. Build comprehension through expository explanation, not just labels
4. Prioritize exam-relevant content above all else

## The PRI Language Problem
PRI uses proprietary nomenclature that overloads and reassigns standard anatomical terms without clearly flagging the departure. This is the central obstacle to learning the material.

Examples:
- Standard joint names are reversed to encode which bone is being treated: "sacroiliac" becomes "ilio-sacral" (target the ilium) or "sacro-iliac" (target the sacrum) — same joint, two names, different treatment targets
- "Internal Rotation" and "External Rotation" in PRI describe the spatial narrowing or widening of a pelvic ring — not conventional rotation around a joint axis
- Each hip joint position gets two names depending on whether the pelvis or femur is the moving bone (AF vs FA)

The app must surface these departures explicitly: "PRI calls this X. In standard anatomy, what is actually happening is Y." The goal is not to adopt PRI's framing uncritically — it is to understand what they are actually describing mechanically, in spite of their terminology.

## How I Learn
I learn by doing and by understanding underlying mechanical logic. Rote memorization does not work for me. The app must:
- Explain the reason before the label
- Show why correct answers are correct and why wrong answers are wrong — and what the wrong answer would actually mean clinically
- Use interactive tools that build comprehension: scenarios, drag-and-drop, multi-select quizzes
- Never just present a term and its definition as if that is sufficient

## Current State
Poor. Significant content, usability, layout, and code quality problems documented in triage-v-01.txt.

## Working Method
- **Claude** handles content, subject matter, expository writing, and planning
- **Claude Code** handles implementation — reads CC-BUILD-SPEC.md for standards and triage-v-01.txt for priorities
- When in doubt about PRI content accuracy, check the manual first
- Exam is March 9. Comprehension and exam prep take priority over code quality