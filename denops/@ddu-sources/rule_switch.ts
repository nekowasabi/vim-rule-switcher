import {
  BaseSource,
  DduOptions,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v3.10.2/types.ts";
import { Denops } from "https://deno.land/x/ddu_vim@v3.10.2/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.7.1/file.ts";
import { Condition, getSwitcherRule } from "../switcher/common.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

type Params = Record<never, never>;

function getFiles(switcher: Condition): string[] {
  return switcher.path.map((path: string) => {
    return path;
  });
}

async function getGitFiles(
  denops: Denops,
  switcher: Condition,
  result: Array<string>,
): Promise<string[]> {
  const gitRoot = (await fn.system(denops, "git rev-parse --show-toplevel"))
    .trim();

  return switcher.path
    .flatMap((file: string) =>
      result
        .filter((r: string) => r.includes(file))
        .map((r: string) => `${gitRoot}/${r}`)
    );
}

export class Source extends BaseSource<Params> {
  override kind = "rule_switch";

  override gather(args: {
    denops: Denops;
    options: DduOptions;
    sourceOptions: SourceOptions;
    sourceParams: Params;
    input: string;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        try {
          const result = ensure(
            await args.denops.call("system", "git ls-files"),
            is.String,
          );
          const filteredResult = result.split("\n").filter((file: string) =>
            file !== ""
          );

          const type = result.includes("fatal: not a git repository") ||
              result.includes("not a git repository")
            ? "file"
            : "git";

          const switcher: Condition | undefined = await getSwitcherRule(
            args.denops,
            type,
          );

          const files = type === "file"
            ? getFiles(switcher)
            : await getGitFiles(args.denops, switcher, filteredResult);
          const items: Item<ActionData>[] = files.map((file: string) => ({
            word: file,
            action: {
              path: file,
            },
          }));
          controller.enqueue(items);
        } catch (e: unknown) {
          console.error(e);
        }
        controller.close();
      },
    });
  }

  override params(): Params {
    return {};
  }
}
