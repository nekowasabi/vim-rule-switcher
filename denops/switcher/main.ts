import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import type { Project } from "./common.ts";
import {
  addRule,
  getSwitcherRule,
  openFloatingWindow,
  switchByFileRule,
} from "./common.ts";

const NO_RULE_MESSAGE = "No switch rule found.";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    /**
     * Displays available switch rules in a floating window for selection
     *
     * @param {unknown} name - Optional name to filter rules
     * @returns {Promise<void>} Promise that resolves when selection is complete
     */
    async selectSwitchRule(name?: unknown): Promise<void> {
      const switcher: Project | undefined = await getSwitcherRule(
        denops,
        ensure("file", is.String),
        ensure(name ?? "", is.String),
      );

      if (!switcher) {
        console.log(NO_RULE_MESSAGE);
        return;
      }

      const path = ensure(switcher.path, is.ArrayOf(is.String));
      const pathWithIndex = path.map((p, i) => {
        // フルパスからファイル名だけ取得
        const fileName = p.split("/").pop();
        return `[${i}]: \`${fileName}\` path: ${p}`;
      });

      const bufnr = ensure(
        await n.nvim_create_buf(denops, false, true),
        is.Number,
      );
      await openFloatingWindow(denops, bufnr, pathWithIndex);
    },

    /**
     * Opens a floating window for the specified buffer.
     * The floating window
        is positioned at the center of the terminal.
     *
     * @param {number} index - The buffer number.
     **/
    async openSelectedFile(index: unknown): Promise<void> {
      const validIndex = ensure(index, is.Number);
      const bufnr = ensure(await n.nvim_get_current_buf(denops), is.Number);
      const lines = ensure(
        await n.nvim_buf_get_lines(denops, bufnr, 0, -1, false),
        is.ArrayOf(is.String),
      );

      const selectedLine = lines.find((line) =>
        line.startsWith(`[${validIndex}]`),
      );
      if (!selectedLine) {
        return;
      }

      const filePath = selectedLine.split("path: ").at(-1);
      if (!filePath) {
        return;
      }

      await denops.cmd("fclose!");
      await denops.cmd(`e ${filePath}`);
    },

    /**
     * Save the switch rule
     *
     * @param {unknown} name - Name of the rule to save
     * @returns {Promise<void>} Promise that resolves when the process is complete
     */
    async saveSwitchRule(name: unknown): Promise<void> {
      await addRule(denops, ensure(name, is.String));
    },

    /**
     * Execute switch based on the specified rule name
     *
     * @returns {Promise<boolean>} Promise that returns true if switch succeeds, false if it fails
     */
    async switchByRule(rule: unknown, project: unknown): Promise<boolean> {
      try {
        const ruleName = ensure(rule ?? "file", is.String);
        const projectName = ensure(project ?? "", is.String);

        const switcher = await getSwitcherRule(denops, ruleName, projectName);

        if (!switcher) {
          console.log(NO_RULE_MESSAGE);
          return false;
        }

        await switchByFileRule(denops, switcher);
        return true;
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Switch rule error: ${error.message}`);
        }
        return false;
      }
    },

    /**
     * Open the current switch rule
     *
     * @returns {Promise<void>} Promise that resolves when the process is complete
     */
    async openSwitchRule(): Promise<void> {
      if (!v.g.get(denops, "switch_rule")) {
        console.log(NO_RULE_MESSAGE);
        return;
      }

      const path = ensure(await v.g.get(denops, "switch_rule"), is.String);
      await denops.cmd(`edit ${path}`);
    },
  };

  await denops.cmd(
    `command! -nargs=* SwitchFileByRule call denops#notify("${denops.name}", "switchByRule", [<f-args>])`,
  );

  await denops.cmd(
    `command! -nargs=0 OpenSwitchRule call denops#notify("${denops.name}", "openSwitchRule", [])`,
  );

  await denops.cmd(
    `command! -nargs=1 SaveSwitchRule call denops#notify("${denops.name}", "saveSwitchRule", [<f-args>])`,
  );

  await denops.cmd(
    `command! -nargs=? -complete=customlist,GetRulesName SelectSwitchRule call denops#notify("${denops.name}", "selectSwitchRule", [<f-args>])`,
  );
}
