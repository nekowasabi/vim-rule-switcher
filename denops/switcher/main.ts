import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.4.0/function/nvim/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.17.0/mod.ts";
import { feedkeys } from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";

export async function main(denops: Denops): Promise<void> {
  async function getCurrentFilePath(): Promise<string> {
    return ensure(await fn.expand(denops, "%:p"), is.String);
  }

  denops.dispatcher = {
    async switchByRule(): Promise<void> {
      console.log(getCurrentFilePath());
      console.log(await denops.cmd("echo 'Hello, world!'"));
    },
  };

  await denops.cmd(
    `command! -nargs=0 SwitchFileByRule call denops#notify("${denops.name}", "switchByRule", [])`,
  );
}
