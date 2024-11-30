import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import type { Condition } from "./common.ts";
import {
  addRule,
  getSwitcherRule,
  openFloatingWindow,
  switchByFileRule,
} from "./common.ts";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    /**
     * スイッチルールを選択します
     *
     * @returns {Promise<void>} 処理が完了したときに解決されるPromise
     */
    async selectSwitchRule(name: unknown): Promise<void> {
      const switcher: Condition | undefined = await getSwitcherRule(
        denops,
        ensure("file", is.String),
        ensure(name, is.String),
      );

      if (!switcher) {
        console.log("No switch rule found.");
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
      const bufnr = ensure(await n.nvim_get_current_buf(denops), is.Number);
      const lines = ensure(
        await n.nvim_buf_get_lines(denops, bufnr, 0, -1, false),
        is.ArrayOf(is.String),
      );
      for (const line of lines) {
        if (!line.includes(`[${index}]`)) {
          continue;
        }
        const splitted = line.split(" ");
        const filePath = splitted[splitted.length - 1];
        await denops.cmd("fclose!");
        await denops.cmd(`e ${filePath}`);
        return;
      }
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
     * @param {unknown} rule - Rule name to use for switching
     * @returns {Promise<boolean>} Promise that returns true if switch succeeds, false if it fails
     */
    async switchByRule(rule: unknown): Promise<boolean> {
      try {
        const switcher: Condition | undefined = await getSwitcherRule(
          denops,
          ensure("file", is.String),
          ensure(rule, is.String),
        );

        if (!switcher) {
          console.log("No switch rule found.");
          return false;
        }

        await switchByFileRule(denops, switcher);
        return true;
      } catch (_e) {
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
        console.log("No switch rule found.");
        return;
      }

      const path = ensure(await v.g.get(denops, "switch_rule"), is.String);
      await denops.cmd(`edit ${path}`);
    },
  };

  await denops.cmd(
    `command! -nargs=? SwitchFileByRule call denops#notify("${denops.name}", "switchByRule", [<q-args>])`,
  );

  await denops.cmd(
    `command! -nargs=0 OpenSwitchRule call denops#notify("${denops.name}", "openSwitchRule", [])`,
  );

  await denops.cmd(
    `command! -nargs=1 SaveSwitchRule call denops#notify("${denops.name}", "saveSwitchRule", [<f-args>])`,
  );

  await denops.cmd(
    `command! -nargs=? SelectSwitchRule call denops#notify("${denops.name}", "selectSwitchRule", [<f-args>])`,
  );
}
