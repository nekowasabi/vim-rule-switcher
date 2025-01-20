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
 * カスタムエラークラス
 */
export class SwitcherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwitcherError";
  }
}

/**
 * Gitファイル操作を処理する
 * @param denops Denopsインスタンス
 * @param filePathToOpen 開くファイルのパス
 * @throws {SwitcherError} 一致するファイルが見つからない場合
 * @returns Promise<boolean> 成功状態
 */
async function handleGitFile(
  denops: Denops,
  filePathToOpen: string | undefined,
): Promise<boolean> {
  if (!filePathToOpen) {
    throw new SwitcherError("File path is undefined");
  }

  const result = ensure(await denops.call("system", "git ls-files"), is.String);
  const targetFile = result
    .split("\n")
    .find((file) => file.includes(filePathToOpen));

  if (!targetFile) {
    throw new SwitcherError("No matching file found in git repository");
  }

  const realPath = Deno.realPathSync(ensure(targetFile, is.String));
  return openFile(denops, realPath);
}

/**
 * 現在のファイルパスを含む条件を見つける
 *
 * @param replacedProjects - 検索対象の条件
 * @param currentFile - 現在のファイルパス|ファイル名
 * @param rule - フィルタリングするルール名
 * @param name - さらにフィルタリングするための名前（オプション）
 * @returns 見つかった条件、または見つからない場合はundefined
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
 * スイッチルールの設定を取得する
 *
 * @param denops - Denopsインスタンス
 * @returns スイッチルールの設定を含むPromise
 * @throws {SwitcherError} スイッチルールが見つからない場合
 */
export async function getSwitchers(denops: Denops): Promise<SwitchRule> {
  if (!v.g.get(denops, "switch_rule")) {
    throw new SwitcherError("No switch rule found");
  }

  const path = ensure(await v.g.get(denops, "switch_rule"), is.String);

  const fileContent = await fn.readfile(denops, path);
  ensure(fileContent, is.Array);

  if (fileContent.length === 0) {
    throw new SwitcherError("No switch rule found");
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
 * @param currentPath - 現在のファイルパス
 * @param paths - 切り替え可能なパスの配列
 * @returns 次のファイルパス、または見つからない場合はundefined
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
 * @param denops - Denopsインスタンス
 * @param project - プロジェクト設定
 * @throws {SwitcherError} ファイル切り替えに失敗した場合
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
      if (!filePathToOpen) {
        throw new SwitcherError("No next file path found");
      }
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
  if (!handler) {
    throw new SwitcherError(`Unknown rule type: ${project.rule}`);
  }
  return handler();
}

/**
 * スイッチャールールを取得し、現在のファイルに適用可能なルールを返す
 * @param denops - Denopsインスタンス
 * @param rule - ルールタイプ
 * @param name - オプショナルなプロジェクト名
 * @throws {SwitcherError} ルールが見つからない場合
 */
export async function getSwitcherRule(
  denops: Denops,
  rule: string,
  name?: string,
): Promise<Project> {
  const switchers = await getSwitchers(denops);
  const fileName = ensure(await fn.expand(denops, "%:t:r"), is.String);
  const homeDirectory = ensure(Deno.env.get("HOME"), is.String);

  const replacedConditions = switchers.projects.flatMap((project) =>
    project.rules.map((rule) => {
      const realPath = (path: string) => {
        let updatedPath = path;
        if (updatedPath.includes("%")) {
          updatedPath = updatedPath.replace(
            "%",
            getCommonPart(fileName, { ...rule, name: project.name }),
          );
        }
        return updatedPath.replace("~", homeDirectory);
      };

      return {
        name: project.name,
        path: rule.path.map(realPath),
        rule: rule.rule,
      };
    }),
  );

  const currentFileName = await getCurrentFileName(denops);
  const condition = findProject(
    replacedConditions,
    currentFileName,
    rule,
    name,
  );

  if (!condition) {
    throw new SwitcherError("No matching switch rule found");
  }

  return condition;
}

/**
 * 新しいルールを既存のスイッチルールに追加する
 *
 * @param denops - Denopsインスタンス
 * @param projectName - 新しいルールの名前
 * @throws {SwitcherError} ルールを追加できない場合
 * @returns Promise<void>
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
 * スイッチルールの選択肢をフローティングウィンドウで表示する
 *
 * @param denops - Denopsインスタンス
 * @param name - フィルタリングするルールの名前（オプション）
 * @throws {SwitcherError} ルールが見つからない場合
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
    throw new SwitcherError("No switch rule found");
  }

  const formatPath = (path: string, index: number): string =>
    `[${index}]: \`${path.split("/").pop()}\` path: ${path}`;

  const paths = ensure(switcher.path, is.ArrayOf(is.String));
  const bufnr = ensure(await n.nvim_create_buf(denops, false, true), is.Number);

  await openFloatingWindow(denops, bufnr, paths.map(formatPath));
}

/**
 * 現在のファイルの実際のパスを取得する
 *
 * @param denops - Denopsインスタンス
 * @returns 現在のファイルの実際のパス
 */
export async function getCurrentFileRealPath(denops: Denops): Promise<string> {
  return Deno.realPathSync(await getCurrentFilePath(denops));
}
