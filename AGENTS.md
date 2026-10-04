# Agent instructions

For coding agents other than Claude Code: Codex, Gemini CLI, Cursor, Copilot
and the like. Nothing in the kit needs Claude (the packages are plain Node,
the rules are Markdown), but the rules were written for Claude Code first.
Start here.

## Read first

1. [`CLAUDE.md`](CLAUDE.md), in full, before touching a film. These are the house rules (determinism, movement, timing, picture, sound, brand truth, workflow gates) and they bind every agent, not only Claude.
2. `CLAUDE.local.md`, if it exists: notes for this machine only, git-ignored.
3. Working under `studio/`? It is a separate private repo with rules of its own: read `studio/AGENTS.md` as well.
4. Building a HyperFrames or Manim film (`package.json` → `motionKit.engine`)? Read `engines/<engine>/BUILD.md` too. Their tools are plain command-line installs: a full ffmpeg for HyperFrames, and pixi for Manim (`curl -fsSL https://pixi.sh/install.sh | PIXI_NO_PATH_UPDATE=1 sh`); see `docs/engines.md`.

## Where the rules assume Claude Code

- **The `/reel` skill** lives in `.claude/skills/reel/SKILL.md` and is linked at `.agents/skills/reel` for tools that load skills from there (Codex, Gemini CLI). If yours doesn't, read that file when asked for a video, reel, teaser or promo and follow its steps in order, the stops for shotlist and key-stills approval included.
- **AskUserQuestion** (the intake): ask the same questions in one message and wait for the answers.
- **Built-in browser screenshots** (capturing the real product): use Playwright, or ask the user for screenshots.
- **Critic subagents** (gate 4, the skill's review loop): the two critics must never have seen the build, each other or earlier rounds. If your tool can start a fresh sub-agent with none of this session's context, start two. If it can't, don't score the round yourself (self-scores ran about 2 points high): give the user the prompt below with the paths filled in, ask them to run it in two new sessions, and log what comes back. A critic on a different model from the builder is welcome.

```text
You're judging a short motion-graphics film you haven't seen being made.
Read CLAUDE.md in <repo path> for the house rules, then look at
<review folder>/contact.png (rhythm, variety, composition),
<review folder>/phone.png (360 px wide: can every word be read?),
<review folder>/report.md (motion checks, sound report and scorecard) and,
if it exists, <review folder>/flags.png (each flagged moment up close).
The film's point: "<one-liner from brief.md>".
Score each of the seven scorecard rows from 1 to 10, citing frame numbers,
mark each issue P0 (breaks a house rule or can't be read), P1 or P2,
then name the three issues that cost the most points. Read only: don't edit anything.
```
