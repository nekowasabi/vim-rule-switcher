import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import {
  Condition,
  getSwitcherRule,
  switchByFileRule,
  switchByGitRule,
} from "./common.ts";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    async switchByRule(type: unknown): Promise<void> {
      const switcher: Condition | undefined = await getSwitcherRule(
        denops,
        ensure(type, is.String),
      );

      switcher.rule === "file"
        ? await switchByFileRule(denops, switcher)
        : await switchByGitRule(denops, switcher);
    },

    async openSwitchRuleFile(): Promise<void> {
    },
  };

  await denops.cmd(
    `command! -nargs=? SwitchFileByRule call denops#notify("${denops.name}", "switchByRule", [<q-args>])`,
  );

  await denops.cmd(
    `command! -nargs=? OpenSwitchRuleFile call denops#notify("${denops.name}", "openSwitchRuleFile", [<q-args>])`,
  );
}
