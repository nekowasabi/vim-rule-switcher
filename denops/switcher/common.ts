import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

/**
 * 現在開いているファイルの実際のパスを非同期で取得します。
 *
 * @param {Denops} denops - Denops インスタンス。
 * @returns {Promise<string>} 現在開いているファイルの実際のパスを返す Promise。
 */
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
  let updatedFileName = fileName;
  if (condition.postfix && updatedFileName.endsWith(condition.postfix)) {
    updatedFileName = updatedFileName.replace(condition.postfix, "");
  }
  if (condition.prefix && updatedFileName.startsWith(condition.prefix)) {
    updatedFileName = updatedFileName.replace(condition.prefix, "");
  }
  return updatedFileName;
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
  ruleName: string,
): Condition | undefined {
  const foundCondition =
    replacedConditions.find((c: Condition) => {
      if (c.name === ruleName) {
        return c.path.some((path) => path.includes(currentFile));
      }
      return false;
    }) || replacedConditions.find((c: Condition) => c.path.some((path) => path.includes(currentFile)));
  return foundCondition;
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
  if (!v.g.get(denops, "switch_rule")) {
    console.log("No switch rule found.");
    Deno.exit(1);
  }

  const path = ensure(await v.g.get(denops, "switch_rule"), is.String);

  const fileContent = await fn.readfile(denops, path);
  ensure(fileContent, is.Array);

  if (fileContent.length === 0) {
    console.log("No switch rule found.");
    Deno.exit(1);
  }

  const file = fileContent.join("\n");
  const settings: SwitchRule = JSON.parse(file);

  return ensure(
    settings,
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
export async function switchByFileRule(denops: Denops, condition: Condition): Promise<boolean> {
  const nextFilePathIndex =
    (condition.path.indexOf(ensure(await getCurrentFileRealPath(denops), is.String)) + 1) % condition.path.length;
  const filePathToOpen = condition.path[nextFilePathIndex];

  if (filePathToOpen === undefined) {
    return false;
  }

  await denops.cmd(`:e ${filePathToOpen}`);
  return true;
}

export async function getSwitcherRule(denops: Denops, ruleName: string): Promise<Condition | undefined> {
  const switchers = await getSwitchers(denops);
  const fileName = ensure(await fn.expand(denops, "%:t:r"), is.String);
  const homeDirectroy = ensure(Deno.env.get("HOME"), is.String);
  const replacedConditions = switchers.conditions.map((condition: Condition) => {
    // 無名関数にして処理をまとめる
    const realPath = (path: string) => {
      let updatedPath = path;
      if (updatedPath.includes("%")) {
        updatedPath = updatedPath.replace("%", getCommonPart(fileName, condition));
      }
      return updatedPath.replace("~", homeDirectroy);
    };

    return {
      name: condition.name,
      path: condition.path.map(realPath),
      rule: condition.rule,
    };
  }, fileName);

  const currentFileName: string = await getCurrentFileName(denops);
  const condition: Condition | undefined = findCondition(replacedConditions, currentFileName, ruleName);

  return condition ?? undefined;
}

export type SwitchRule = {
  conditions: {
    name?: string;
    rule: string;
    path: string[];
  }[];
};

export type Condition = {
  name?: string;
  path: string[];
  rule: string;
  postfix?: string;
  prefix?: string;
};

/**
 * Add a new rule to the existing switch rules
 *
 * @param {Denops} denops - Denops instance
 * @param {string} ruleName - Name of the new rule
 * @returns {Promise<void>}
 */
export async function addRule(denops: Denops, ruleName: string): Promise<void> {
  const switchRulePath = ensure(await v.g.get(denops, "switch_rule"), is.String);
  const switchRules: SwitchRule = JSON.parse(await Deno.readTextFile(switchRulePath));

  const filePath = await getCurrentFileRealPath(denops);
  const existingCondition = switchRules.conditions.find((condition) => condition.name === ruleName);

  const condition = existingCondition ?? {
    name: ruleName,
    rule: "file",
    path: [],
  };
  if (!condition.path.includes(filePath)) {
    // add the file path to the condition
    condition.path.push(filePath);
  }
  if (!existingCondition) {
    // add new rule to the beginning of the switch rules
    switchRules.conditions.unshift(condition);
  }

  await Deno.writeTextFile(switchRulePath, JSON.stringify(switchRules, null, 2));
  console.log(`Rule ${ruleName} added successfully.`);
}
