import { SIMPLE } from "./gen-simple.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ALL = [
  { dir:"dsh-wsl-uia", tool:"uia_tree", desc:"Windows UI Automation observation from WSL: enumerate top-level windows and read a bounded element tree with per-observation handles.",
    usage:`uia_tree action=windows                                  # list top-level windows
uia_tree action=tree pid=1234 maxDepth=6 maxElements=200  # bounded element tree
uia_tree action=find controlType=Button actionableOnly=true`,
    notes:`Every element carries a handle like \`1790525657168.6\`. The number before the dot is
the observation epoch, so a handle from an older observation is identifiable. Element
**index is not a stable identity** on a live window — two walks of the same tree can
disagree — so pass \`expectName\` to \`win_invoke\` rather than relying on position.` },
  { dir:"dsh-wsl-wininput", tool:"win_invoke", desc:"Targeted Windows input from WSL: invoke a UI Automation element, or send keys and clicks to a chosen window without stealing focus.",
    usage:`win_invoke action=invoke pid=1234 expectName="Save" expectType=Button
win_invoke action=type pid=1234 text="hello"
win_invoke action=click pid=1234 x=100 y=40`,
    notes:`\`expectName\` is **required** for \`invoke\`. Elements are found by name, and the
match must be unique: no match means the element is gone, more than one means the name
is too general to act on. Both are refusals, not best-effort clicks.

An earlier version took the element *index* from a \`uia_tree\` handle. Testing showed
two consecutive walks of a live window disagree about what sits at a given index, which
turned an invoke into a click on whatever had moved into that slot.` },
  { dir:"dsh-wsl-winshot", tool:"win_shot_window", desc:"Capture a specific Windows window to a WSL file, by process id or window handle.",
    usage:`win_shot_window                                        # foreground window
win_shot_window pid=1234 name="build-output"           # a specific process`,
    notes:`Use this when you need the **picture**. Use \`dsh-wsl-shot\` when the image is
already on the clipboard. A minimized window is restored before measuring, because a
minimized window reports an empty rectangle.` },
  { dir:"dsh-wsl-winctl", tool:"win_windows", desc:"Enumerate and control Windows top-level windows from WSL: activate, minimize, restore, move and resize.",
    usage:`win_windows action=windows
win_windows action=activate titleContains="Notepad"
win_windows action=move pid=1234 x=0 y=0 width=1280 height=800`,
    notes:`Every action names its target by \`pid\` or \`titleContains\`; nothing acts on
whatever happens to be focused. \`move\` requires a position **and** a positive size —
a half-specified move is refused rather than guessed at.` },
];

for (const p of ALL) {
  const d = p.dir;
  writeFileSync(join(d, "README.md"), `# ${d}

DeepSeek Harness plugin: ${p.desc}

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## Install

\`\`\`sh
dsh plugin --profile web add github:173787247/${d}
\`\`\`

## Usage

\`\`\`
${p.usage}
\`\`\`

## Notes

${p.notes}

## Requirements

- Windows with WSL, and DeepSeek Harness running inside it.
- PowerShell reachable at the standard path (the plugin finds it itself).

## Tests

\`\`\`sh
npm test
\`\`\`

The unit tests run anywhere. The live tests are skipped outside WSL.

## License

MIT
`);
  console.log("  ✓ " + d + "/README.md");
}
