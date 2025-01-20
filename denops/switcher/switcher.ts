import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import type { Project, RuleType, SwitchRule } from "./type.ts";
import { openFloatingWindow } from "./ui.ts";
import {
  getCommonPart,
  getCurrentFileName,
  getCurrentFilePath,
  openFile,
} from "./util.ts";

/**
 * Handles git file operations
 * @param denops Denops instance
 * @param filePathToOpen Path to the file to open
 * @returns Promise<boolean> Success status
 */
async function handleGitFile(
  denops: Denops,
  filePathToOpen: string | undefined,
): Promise<boolean> {
  if (!filePathToOpen) return false;

  const result = ensure(await denops.call("system", "git ls-files"), is.String);
  const targetFile = result
    .split("\n")
    .find((file) => file.includes(filePathToOpen));

  if (!targetFile) {
    console.log("No switch rule found.");
    return false;
  }

  const realPath = Deno.realPathSync(ensure(targetFile, is.String));
  return openFile(denops, realPath);
}

export async function getCurrentFileRealPath(denops: Denops): Promise<string> {
  return Deno.realPathSync(await getCurrentFilePath(denops));
}

/**
 * 現在のファイルパスを含む条件を見つける
 *
 * @param {Project[]} replacedProjects - The conditions to search in.
 * @param {string} currentFile - The current file path|file name to find.
 * @param {string} rule - The rule name to filter conditions.
 * @param {string} [name] - Optional name to further filter conditions.
 * @returns {Project | undefined} - The found condition or undefined if not found.
 */
export function findProject(
  replacedProjects: Project[],
  currentFile: string,
  rule: string,
  name?: string,
): Project | undefined {
  const foundProject =
    rule === "file"
      ? replacedProjects.find(
          (c: Project) =>
            (c.rule === rule && c.name === name) ||
            c.path.some((path) => path.includes(currentFile)),
        )
      : rule === "git"
        ? replacedProjects.find((c: Project) => c.rule === rule)
        : undefined;
  return foundProject;
}

/**
 * `getSwitchers`関数は、設定されたスイッチルールを取得します。
 *
 * @param {Denops} denops - Denopsオブジェクト
 * @returns {Promise<unknown>} スイッチルールの設定を含むPromiseを返します。
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
    is.ObjectOf({
      projects: is.ArrayOf(
        is.ObjectOf({
          name: is.String,
          rules: is.ArrayOf(
            is.ObjectOf({
              rule: is.LiteralOneOf(["file", "git"] as const),
              path: is.ArrayOf(is.String),
            }),
          ),
        }),
      ),
    }),
  );
}

/**
 * ファイルパスの循環的な切り替えを行うヘルパー関数
 *
 * @param {Project} project - スイッチングの条件を定義するオブジェクト。
 * @returns {Promise<boolean>} スイッチングが完了したら解決されるPromise。
 */
const getNextFilePath = (
  currentPath: string,
  paths: string[],
): string | undefined => {
  const currentIndex = paths.findIndex(
    (path) => currentPath.includes(path) || path.includes(currentPath),
  );
  if (currentIndex === -1) return undefined;
  return paths[(currentIndex + 1) % paths.length];
};

/**
 * ルールに基づいてファイル切り替えを行う
 */
export async function switchByFileRule(
  denops: Denops,
  project: Project,
): Promise<boolean> {
  const handlers: Record<RuleType, () => Promise<boolean>> = {
    file: async () => {
      const currentPath = ensure(
        await getCurrentFileRealPath(denops),
        is.String,
      );
      const filePathToOpen = getNextFilePath(currentPath, project.path);
      return openFile(denops, filePathToOpen);
    },
    git: async () => {
      const currentFileName = ensure(
        await getCurrentFileName(denops),
        is.String,
      );
      const filePathToOpen = getNextFilePath(currentFileName, project.path);
      return handleGitFile(denops, filePathToOpen);
    },
  };

  const handler = handlers[project.rule];
  return handler ? await handler() : false;
}

export async function getSwitcherRule(
  denops: Denops,
  rule: string,
  name?: string,
): Promise<Project | undefined> {
  const switchers = await getSwitchers(denops);
  const fileName = ensure(await fn.expand(denops, "%:t:r"), is.String);
  const homeDirectroy = ensure(Deno.env.get("HOME"), is.String);
  const replacedConditions = switchers.projects.flatMap((project) =>
    project.rules.map((rule) => {
      // 無名関数にして処理をまとめる
      const realPath = (path: string) => {
        let updatedPath = path;
        if (updatedPath.includes("%")) {
          updatedPath = updatedPath.replace(
            "%",
            getCommonPart(fileName, { ...rule, name: project.name }),
          );
        }
        return updatedPath.replace("~", homeDirectroy);
      };

      return {
        name: project.name,
        path: rule.path.map(realPath),
        rule: rule.rule,
      };
    }),
  );

  const currentFileName: string = await getCurrentFileName(denops);
  const condition: Project | undefined = findProject(
    replacedConditions,
    currentFileName,
    rule,
    name,
  );

  return condition ?? undefined;
}

/**
 * Add a new rule to the existing switch rules
 *
 * @param {Denops} denops - Denops instance
 * @param {string} projectName - Name of the new rule
 * @returns {Promise<void>}
 */
export async function addRule(
  denops: Denops,
  projectName: string,
): Promise<void> {
  const switchRulePath = ensure(
    await v.g.get(denops, "switch_rule"),
    is.String,
  );
  const switchRules: SwitchRule = JSON.parse(
    await Deno.readTextFile(switchRulePath),
  );

  const filePath = await getCurrentFileRealPath(denops);
  const existingCondition = switchRules.projects.find(
    (project) => project.name === projectName,
  );

  const condition = existingCondition ?? {
    name: projectName,
    rules: [
      {
        rule: "file",
        path: [],
      },
    ],
  };

  if (!condition.rules[0].path.includes(filePath)) {
    // add the file path to the condition
    condition.rules[0].path.push(filePath);
  }

  if (!existingCondition) {
    // add new project to the beginning of the projects array
    switchRules.projects.unshift(condition);
  }

  await Deno.writeTextFile(
    switchRulePath,
    JSON.stringify(switchRules, null, 2),
  );
  console.log(`Rule ${projectName} added successfully.`);
}

/**
 * スイッチルールの選択肢をフローティングウィンドウで表示します。
 *
 * @param {Denops} denops - Denops のインスタンス
 * @param {unknown} [name] - フィルタリングするルールの名前 (オプション)
 * @returns {Promise<void>}
 */
export async function selectSwitchRule(
  denops: Denops,
  name?: unknown,
): Promise<void> {
  const switcher = await getSwitcherRule(
    denops,
    "file",
    ensure(name ?? "", is.String),
  );

  if (!switcher) {
    console.log("No switch rule found.");
    return;
  }

  const formatPath = (path: string, index: number): string =>
    `[${index}]: \`${path.split("/").pop()}\` path: ${path}`;

  const paths = ensure(switcher.path, is.ArrayOf(is.String));
  const bufnr = ensure(await n.nvim_create_buf(denops, false, true), is.Number);

  await openFloatingWindow(denops, bufnr, paths.map(formatPath));
}
