import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
// import * as n from "https://deno.land/x/denops_std@v6.4.0/function/nvim/mod.ts";
// import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
// import {feedkeys} from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
// import { realPathSync } from "https://deno.land/std@0.114.0/fs/mod.ts";

export async function main(denops: Denops): Promise<void> {
  async function getCurrentFilePath(): Promise<string> {
    return ensure(await fn.expand(denops, "%:p"), is.String);
  }

  denops.dispatcher = {
    async switchByRule(): Promise<void> {
      const files = [
        "~/.config/nvim/init.vim",
        "~/.config/nvim/rc/plugin.vim",
      ];

      const homeDirectroy = ensure(Deno.env.get("HOME"), is.String);

      const absolutePaths = files.map((file: string) => {
        const filePath = file.replace("~", homeDirectroy);
        return Deno.realPathSync(filePath);
      });

      const currentFilePath = Deno.realPathSync(await getCurrentFilePath());
      const isInclude = absolutePaths.includes(currentFilePath);

      if (isInclude) {
        const nextFilePath = absolutePaths[
          (absolutePaths.indexOf(currentFilePath) + 1) % absolutePaths.length
        ];

        await denops.cmd(`:e ${nextFilePath}`);
      }
    },
  };

  await denops.cmd(
    `command! -nargs=0 SwitchFileByRule call denops#notify("${denops.name}", "switchByRule", [])`,
  );
}
