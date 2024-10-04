import { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
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
    c.path.some((path) => path.includes(currentFile))
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
  if (!v.g.get(denops, "switch_rule")) {
    console.log("No switch rule found.");
    Deno.exit(1);
  }

  const path = ensure(await v.g.get(denops, "switch_rule"), is.String);

  const fileContent = await fn.readfile(denops, path);
  ensure(fileContent, is.Array);

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
export async function switchByFileRule(
  denops: Denops,
  condition: Condition,
): Promise<boolean> {
  const nextFilePathIndex = (condition.path.indexOf(
    ensure(await getCurrentFileRealPath(denops), is.String),
  ) + 1) %
    condition.path.length;
  const filePathToOpen = condition.path[nextFilePathIndex];

  if (filePathToOpen === undefined) {
    return false;
  }

  await denops.cmd(`:e ${filePathToOpen}`);
  return true;
}

export async function getSwitcherRule(
  denops: Denops,
  type: string,
): Promise<Condition> {
  const switchers = await getSwitchers(denops);
  const fileName = ensure(await fn.expand(denops, "%:t:r"), is.String);
  const homeDirectroy = ensure(Deno.env.get("HOME"), is.String);
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
        path: condition.path.map(realPath),
        rule: condition.rule,
      };
    },
    fileName,
  ).filter((condition: Condition) => {
    return type === "git"
      ? condition.rule === "git"
      : condition.rule === "file";
  });

  const currentFilePath: string = await getCurrentFileRealPath(denops);
  const currentFileName: string = await getCurrentFileName(denops);
  const fileForSearch = type !== "git" ? currentFilePath : currentFileName;

  const condition: Condition | undefined = findCondition(
    replacedConditions,
    fileForSearch,
  );

  if (!condition) {
    const ac = new AbortController();
    // console.log("No condition found.");
    ac.abort();
    throw ("");
  }

  return condition;
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
export async function addRule(
  denops: Denops,
  ruleName: string,
): Promise<void> {
  const switchRulePath = ensure(
    await v.g.get(denops, "switch_rule"),
    is.String,
  );
  const switchRules: SwitchRule = JSON.parse(
    await Deno.readTextFile(switchRulePath),
  );

  const existingCondition = switchRules.conditions.find((condition) =>
    condition.name === ruleName
  );

  const filePath = await getCurrentFileRealPath(denops);

  if (existingCondition) {
    if (!existingCondition.path.includes(filePath)) {
      existingCondition.path.push(filePath);
    }
  } else {
    switchRules.conditions.push({
      name: ruleName,
      rule: "file",
      path: [filePath],
    });
  }

  await Deno.writeTextFile(
    switchRulePath,
    JSON.stringify(switchRules, null, 2),
  );
}
