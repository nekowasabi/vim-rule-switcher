import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

export async function getCurrentFileRealPath(denops: Denops): Promise<string> {
  return Deno.realPathSync(await getCurrentFilePath(denops));
}

/**
 * 現在のファイル名を返す
 *
 * @returns {Promise<string>} The current file name.
 */
export async function getCurrentFileName(denops: Denops): Promise<string> {
  return ensure(await fn.expand(denops, "%:t"), is.String);
}

/**
 * 現在のファイルパスを返す
 *
 * @returns {Promise<string>} The current file path.
 */
export async function getCurrentFilePath(denops: Denops): Promise<string> {
  return ensure(await fn.expand(denops, "%:p"), is.String);
}

/**
 * ファイル名から共通部分を取得する
 *
 * @param {string} fileName ファイル名
 * @param {Condition} condition 条件
 * @returns 共通部分
 */
export function getCommonPart(fileName: string, condition: Condition): string {
  if (condition.postfix && fileName.endsWith(condition.postfix)) {
    fileName = fileName.replace(condition.postfix, "");
  }
  if (condition.prefix && fileName.startsWith(condition.prefix)) {
    fileName = fileName.replace(condition.prefix, "");
  }
  return fileName;
}

/**
 * 現在のファイルパスを含む条件を見つける
 *
 * @param {Condition[]} replacedConditions - The conditions to search in.
 * @param {string} currentFile - The current file path|file name to find.
 * @returns {Condition | undefined} - The found condition or undefined if not found.
 */
export function findCondition(
  replacedConditions: Condition[],
  currentFile: string,
): Condition | undefined {
  return replacedConditions.find((c: Condition) =>
    c.path.includes(currentFile)
  );
}

/**
 * `getSwitchers`関数は、設定されたスイッチルールを取得します。
 *
 * @param {Denops} denops - Denopsオブジェクト
 * @returns {Promise<unknown>} スイッチルールの設定を含むPromiseを返します。
 * スイッチルールの設定は以下の形式を持つオブジェクトです:
 * {
 *   conditions: [
 *     {
 *       rule: string,
 *       path: string[],
 *     },
 *     ...
 *   ],
 * }
 *
 * @throws {Error} スイッチルールの設定が期待する形式でない場合、エラーをスローします。
 */
export async function getSwitchers(denops: Denops): Promise<SwitchRule> {
  return ensure(
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
}

/**
 * ファイル用ルールに基づいてファイル切り替えを行う
 *
 * @param {Condition} condition - スイッチングの条件を定義するオブジェクト。
 * @returns {Promise<void>} スイッチングが完了したら解決されるPromise。
 */
export async function switchByFileRule(
  denops: Denops,
  condition: Condition,
): Promise<void> {
  const nextFilePathIndex = (condition.path.indexOf(
    ensure(await getCurrentFileRealPath(denops), is.String),
  ) + 1) %
    condition.path.length;
  const filePathToOpen = condition.path[nextFilePathIndex];

  await denops.cmd(`:e ${filePathToOpen}`);
}

/**
 * Gitルールに基づいてファイル切り替えを行う
 *
 * @param {Condition} condition - スイッチングの条件を定義するオブジェクト
 * @returns {Promise<void>} スイッチングが完了したら解決されるPromise
 */
export async function switchByGitRule(
  denops: Denops,
  condition: Condition,
): Promise<void> {
  const nextFileIndex = (condition.path.indexOf(
    ensure(await getCurrentFileName(denops), is.String),
  ) + 1) %
    condition.path.length;
  const nextFileName = condition.path[nextFileIndex];

  const files = (await fn.system(denops, "git ls-files")).trim().split(
    "\n",
  );

  // filesからnextFileNameが含まれている最初の項目を取得する
  const nextFilePath = files.find((file) =>
    file.includes(nextFileName)
  ) as string;

  if (nextFilePath === undefined) {
    console.log("No file found.");
    Deno.exit(1);
  }

  const gitRoot = (await fn.system(denops, "git rev-parse --show-toplevel"))
    .trim();
  const filePathToOpen = `${gitRoot}/${nextFilePath}`;

  await denops.cmd(`:e ${filePathToOpen}`);
}

type SwitchRule = {
  conditions: {
    rule: string;
    path: string[];
  }[];
};

type Condition = {
  path: string[];
  rule: string;
  postfix?: string;
  prefix?: string;
};
