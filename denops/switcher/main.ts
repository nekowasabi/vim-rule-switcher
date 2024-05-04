import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

export async function main(denops: Denops): Promise<void> {
  /**
   * Returns the current file path.
   *
   * @returns {Promise<string>} The current file path.
   */
  async function getCurrentFilePath(): Promise<string> {
    return ensure(await fn.expand(denops, "%:p"), is.String);
  }

  /**
   * ファイル名から共通部分を取得する
   * @param fileName ファイル名
   * @param condition 条件
   * @returns 共通部分
   */
  function getCommonPart(fileName: string, condition: Condition): string {
    if (condition.postfix && fileName.endsWith(condition.postfix)) {
      fileName = fileName.replace(condition.postfix, "");
    }
    if (condition.prefix && fileName.startsWith(condition.prefix)) {
      fileName = fileName.replace(condition.prefix, "");
    }
    return fileName;
  }

  /**
   * Finds the condition that includes the current file path.
   *
   * @param {Condition[]} replacedConditions - The conditions to search in.
   * @param {string} currentFile - The current file path|file name to find.
   * @returns {Condition | undefined} - The found condition or undefined if not found.
   */
  function findCondition(
    replacedConditions: Condition[],
    currentFile: string,
  ): Condition | undefined {
    return replacedConditions.find((c: Condition) =>
      c.path.includes(currentFile)
    );
  }

  type Condition = {
    path: string[];
    rule: string;
    postfix?: string;
    prefix?: string;
  };

  const fileName = ensure(await fn.expand(denops, "%:t:r"), is.String);

  const homeDirectroy = ensure(Deno.env.get("HOME"), is.String);

  denops.dispatcher = {
    async switchByRule(type: unknown): Promise<void> {
      ensure(type, is.String);
      const switchers = ensure(
        await v.g.get(denops, "switch_rule"),
        // jsonの形式を模倣して型を判定する
        is.ObjectOf({
          conditions: is.ArrayOf(
            is.ObjectOf({
              rule: is.String,
              path: is.ArrayOf(is.String),
            }),
          ),
        }),
      );

      // pathの中に~が含まれている場合は、それをホームディレクトリに置き換える
      // switchers.conditionsの中身を書き換える
      const replacedConditions = switchers.conditions.map(
        (condition: Condition) => {
          // 無名関数にして処理をまとめる
          const realPath = (path: string) => {
            if (path.includes("%")) {
              path = path.replace("%", getCommonPart(fileName, condition));
            }
            return path.replace("~", homeDirectroy);
          };

          return {
            // jsonを組み立てればいいのか
            path: condition.path.map(realPath),
            rule: condition.rule,
          };
        },
        fileName,
      );

      const currentFilePath = Deno.realPathSync(await getCurrentFilePath());
      const currentFileName = ensure(
        await fn.expand(denops, "%:t"),
        is.String,
      );
      const file = type !== "git" ? currentFilePath : currentFileName;

      const condition: Condition | undefined = findCondition(
        replacedConditions,
        file,
      );

      if (!condition) {
        return;
      }

      // ruleに沿ってパスを取得する
      if (condition.rule === "file") {
        const nextFilePathIndex =
          (condition.path.indexOf(currentFilePath) + 1) %
          condition.path.length;
        const nextFilePath = condition.path[nextFilePathIndex];
        await denops.cmd(`:e ${nextFilePath}`);
      }

      // rule: gitの場合は、git ls-filesで取得して、最初の候補を取得する（候補が複数ある場合は、ddu起動予定）
      if (condition.rule === "git") {
        const nextFileIndex = (condition.path.indexOf(currentFileName) + 1) %
          condition.path.length;
        const nextFileName = condition.path[nextFileIndex];

        const files = (await fn.system(denops, "git ls-files")).trim().split(
          "\n",
        );

        // filesからnextFileNameが含まれている項目を取得する
        const nextFilePath = files.find((file) =>
          file.includes(nextFileName)
        ) as string;

        // パスを生成
        const gitRoot =
          (await fn.system(denops, "git rev-parse --show-toplevel")).trim();
        const filePathToOpen = `${gitRoot}/${nextFilePath}`;

        await denops.cmd(`:e ${filePathToOpen}`);
      }
    },
  };

  await denops.cmd(
    `command! -nargs=? SwitchFileByRule call denops#notify("${denops.name}", "switchByRule", [<q-args>])`,
  );
}
