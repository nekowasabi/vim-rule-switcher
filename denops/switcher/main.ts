import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import type { Condition } from "./common.ts";
import { addRule, getSwitcherRule, switchByFileRule } from "./common.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    /**
     * スイッチルールを選択します
     *
     * @returns {Promise<void>} 処理が完了したときに解決されるPromise
     */
    async selectSwitchRule(): Promise<void> {
      const switcher: Condition | undefined = await getSwitcherRule(
        denops,
        ensure("file", is.String),
      );

      if (!switcher) {
        console.log("No switch rule found.");
        return;
      }

      const path = ensure(switcher.path, is.ArrayOf(is.String));
      const pathWithIndex = path.map((p, i) => {
        // フルパスからファイル名だけ取得
        const fileName = p.split("/").pop();
        return `[${i}]:  ${fileName}\npath: ${p}\n`;
      });
      const index = ensure(
        await denops.call("inputlist", pathWithIndex),
        is.Number,
      );

      if (index === -1) {
        return;
      }
      await denops.cmd(`edit ${path[index]}`);
    },
    /**
     * スイッチルールを保存します
     *
     * @param {unknown} name - 保存するルールの名前
     * @returns {Promise<void>} 処理が完了したときに解決されるPromise
     */
    async saveSwitchRule(name: unknown): Promise<void> {
      await addRule(denops, ensure(name, is.String));
    },

    /**
     * 指定されたルール名に基づいてスイッチを実行します
     *
     * @param {unknown} ruleName - スイッチに使用するルール名
     * @returns {Promise<boolean>} スイッチが成功した場合はtrue、失敗した場合はfalseを返すPromise
     */
    async switchByRule(ruleName: unknown): Promise<boolean> {
      try {
        const switcher: Condition | undefined = await getSwitcherRule(
          denops,
          ensure(ruleName, is.String),
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
     * 現在のスイッチルールを開きます。
     *
     * @returns {Promise<void>} 処理が完了したときに解決されるPromise。
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
    `command! -nargs=0 SelectSwitchRule call denops#notify("${denops.name}", "selectSwitchRule", [<f-args>])`,
  );
}
