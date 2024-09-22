import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import {
  Condition,
  getSwitcherRule,
  switchByFileRule,
  switchByGitRule,
} from "./common.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    async saveSwitchRule(name: unknown): Promise<void> {
      if (!v.g.get(denops, "switch_rule")) {
        console.log("No switch rule found.");
        return;
      }

      const json_path = ensure(
        await v.g.get(denops, "switch_rule"),
        is.String,
      );
      const rule_string = await Deno.readTextFile(json_path);
    },

    async switchByRule(type: unknown): Promise<boolean> {
      try {
        const switcher: Condition | undefined = await getSwitcherRule(
          denops,
          ensure(type, is.String),
        );

        switcher.rule === "file"
          ? await switchByFileRule(denops, switcher)
          : await switchByGitRule(denops, switcher);
        return true;
      } catch (_e) {
      }
      return false;
    },

    async openSwitchRuleFile(): Promise<void> {
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
    `command! -nargs=0 OpenSwitchRuleFile call denops#notify("${denops.name}", "openSwitchRuleFile", [])`,
  );

  await denops.cmd(
    `command! -nargs=1 SaveSwitchRule call denops#notify("${denops.name}", "saveSwitchRule", [<f-args>])`,
  );
}
