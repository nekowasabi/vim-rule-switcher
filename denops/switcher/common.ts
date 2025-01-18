import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import { ensure, is, maybe } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

/**
 * プロジェクトの設定を表す型
 *
 * @property {string} [name] - プロジェクトの名前（オプション）
 * @property {string[]} path - ファイルパスの配列
 * @property {string} rule - 適用するルール（'file' または 'git'）
 * @property {string} [postfix] - ファイル名の後置文字列（オプション）
 * @property {string} [prefix] - ファイル名の前置文字列（オプション）
 */
export type Project = {
  name?: string;
  path: string[];
  rule: string;
  postfix?: string;
  prefix?: string;
};

/**
 * スイッチルールの設定を表す型
 *
 * @property {Object[]} projects - プロジェクトの配列
 * @property {string} projects[].name - プロジェクトの名前
 * @property {Object[]} projects[].rules - プロジェクトのルール配列
 * @property {string} projects[].rules[].rule - ルールの種類
 * @property {string[]} projects[].rules[].path - ルールに関連するパスの配列
 */
export type SwitchRule = {
  projects: {
    name: string;
    rules: {
      rule: string;
      path: string[];
    }[];
  }[];
};

/**
 * Opens a file in the editor
 *
 * @param denops Denops instance
 * @param filePath Path to the file to open
 * @returns Promise<boolean> Success status
 */
async function openFile(denops: Denops, filePath: string | undefined): Promise<boolean> {
  if (!filePath) return false;
  await denops.cmd(`:e ${filePath}`);
  return true;
}

/**
 * Handles git file operations
 * @param denops Denops instance
 * @param filePathToOpen Path to the file to open
 * @returns Promise<boolean> Success status
 */
async function handleGitFile(denops: Denops, filePathToOpen: string | undefined): Promise<boolean> {
  if (!filePathToOpen) return false;

  const result = ensure(await denops.call("system", "git ls-files"), is.String);
  const targetFile = result.split("\n").find((file) => file.includes(filePathToOpen));
  
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
 * @param {Project} project 条件
 * @returns 共通部分
 */
export function getCommonPart(fileName: string, project: Project): string {
  let updatedFileName = fileName;
  if (project.postfix && updatedFileName.endsWith(project.postfix)) {
    updatedFileName = updatedFileName.replace(project.postfix, "");
  }
  if (project.prefix && updatedFileName.startsWith(project.prefix)) {
    updatedFileName = updatedFileName.replace(project.prefix, "");
  }
  return updatedFileName;
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
  let foundProject: Project | undefined;
  if (rule === "file") {
    foundProject =
    replacedProjects.find((c: Project) => {
      if (c.rule === rule && c.name === name) {
        return c.path;
      }
      return false;
    }) || replacedProjects.find((c: Project) => c.path.some((path) => path.includes(currentFile)));

  }
  if (rule === "git") {
    foundProject = replacedProjects.find((c: Project) => c.rule === rule);

  }
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
              rule: is.String,
              path: is.ArrayOf(is.String),
            })
          ),
        })
      ),
    }),
  );
}

/**
 * ファイル用ルールに基づいてファイル切り替えを行う
 *
 * @param {Project} project - スイッチングの条件を定義するオブジェクト。
 * @returns {Promise<boolean>} スイッチングが完了したら解決されるPromise。
 */
export async function switchByFileRule(denops: Denops, project: Project): Promise<boolean> {
  const getNextFilePath = (currentPath: string, paths: string[]): string | undefined => {
    const currentIndex = paths.findIndex(path => currentPath.includes(path) || path.includes(currentPath));
    const nextIndex = currentIndex === paths.length - 1 ? 0 : currentIndex + 1;
    return paths[nextIndex];
  };

  switch (project.rule) {
    case "file": {
      const currentPath = ensure(await getCurrentFileRealPath(denops), is.String);
      const filePathToOpen = getNextFilePath(currentPath, project.path);
      return openFile(denops, filePathToOpen);
    }
    
    case "git": {
      const currentFileName = ensure(await getCurrentFileName(denops), is.String);
      const filePathToOpen = getNextFilePath(currentFileName, project.path);
      return handleGitFile(denops, filePathToOpen);
    }

    default:
      return false;
  }
}

export async function getSwitcherRule(
  denops: Denops,
  rule: string,
  name?: string
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
          updatedPath = updatedPath.replace("%", getCommonPart(fileName, { ...rule, name: project.name }));
        }
        return updatedPath.replace("~", homeDirectroy);
      };

      return {
        name: project.name,
        path: rule.path.map(realPath),
        rule: rule.rule,
      };
    })
  );

  const currentFileName: string = await getCurrentFileName(denops);
  const condition: Project | undefined = findProject(replacedConditions, currentFileName, rule, name);

  return condition ?? undefined;
}

/**
 * Add a new rule to the existing switch rules
 *
 * @param {Denops} denops - Denops instance
 * @param {string} projectName - Name of the new rule
 * @returns {Promise<void>}
 */
export async function addRule(denops: Denops, projectName: string): Promise<void> {
  const switchRulePath = ensure(await v.g.get(denops, "switch_rule"), is.String);
  const switchRules: SwitchRule = JSON.parse(await Deno.readTextFile(switchRulePath));

  const filePath = await getCurrentFileRealPath(denops);
  const existingCondition = switchRules.projects.find((project) => project.name === projectName);

  const condition = existingCondition ?? {
    name: projectName,
    rules: [{
      rule: "file",
      path: [],
    }],
  };

  if (!condition.rules[0].path.includes(filePath)) {
    // add the file path to the condition
    condition.rules[0].path.push(filePath);
  }

  if (!existingCondition) {
    // add new project to the beginning of the projects array 
    switchRules.projects.unshift(condition);
  }

  await Deno.writeTextFile(switchRulePath, JSON.stringify(switchRules, null, 2));
  console.log(`Rule ${projectName} added successfully.`);
}

function calculateWindowDimensions(
  terminalWidth: number,
  terminalHeight: number,
  contentHeight: number,
  windowWidth: number
) {
  return {
    width: windowWidth,
    height: contentHeight,
    row: Math.floor((terminalHeight - contentHeight) / 2),
    col: Math.floor((terminalWidth - windowWidth) / 2),
  };
}

async function setupWindowOptions(denops: Denops, bufnr: number) {
  await denops.cmd("normal! gg");
  await denops.cmd("set nonumber");
  await n.nvim_buf_set_option(denops, bufnr, "modifiable", false);
  await n.nvim_buf_set_option(denops, bufnr, "wrap", false);
  await n.nvim_buf_set_option(denops, bufnr, "buftype", "nofile");
}

async function setupKeyMappings(denops: Denops, bufnr: number) {
  // 数字キーのマッピング
  for (let i = 0; i <= 9; i++) {
    await n.nvim_buf_set_keymap(
      denops,
      bufnr,
      "n",
      i.toString(),
      `<cmd>call denops#notify('switcher', 'openSelectedFile', [${i}])<CR>`,
      { silent: true }
    );
  }

  // エンターキーのマッピング
  await n.nvim_buf_set_keymap(
    denops,
    bufnr,
    "n",
    "o",
    "<cmd>call denops#notify('switcher', 'openSelectedFile', [line('.') - 1])<CR>",
    { silent: true }
  );

  // 終了キーのマッピング
  await n.nvim_buf_set_keymap(denops, bufnr, "n", "q", "<cmd>fclose!<CR>", {
    silent: true,
  });
}

export async function openFloatingWindow(denops: Denops, bufnr: number, pathWithIndex: string[]): Promise<void> {
  const terminal_width = Math.floor(ensure(await n.nvim_get_option(denops, "columns"), is.Number));
  const terminal_height = Math.floor(ensure(await n.nvim_get_option(denops, "lines"), is.Number));
  const floatWinWidth = maybe(await v.g.get(denops, "aider_floatwin_width"), is.Number) || 100;

  const dimensions = calculateWindowDimensions(
    terminal_width,
    terminal_height,
    pathWithIndex.length,
    floatWinWidth
  );

  await n.nvim_open_win(denops, bufnr, true, {
    relative: "editor",
    border: "double",
    ...dimensions
  });

  await n.nvim_buf_set_lines(denops, bufnr, 0, 0, true, pathWithIndex);
  await setupWindowOptions(denops, bufnr);
  await setupKeyMappings(denops, bufnr);
}

/**
 * Displays available switch rules in a floating window for selection
 *
 * @param {unknown} name - Optional name to filter rules
 * @returns {Promise<void>} Promise that resolves when selection is complete
 */
/**
 * Execute switch based on the specified rule name
 *
 * @param {unknown} rule - The rule to use for switching
 * @param {unknown} project - The project name to filter rules
 * @returns {Promise<boolean>} Promise that returns true if switch succeeds, false if it fails
 */
async function switchByRule(rule: unknown, project: unknown): Promise<boolean> {
  try {
    // パラメータの正規化
    const normalizedParams = {
      ruleName: rule ? ensure(rule, is.String) : "file",
      projectName: project ? ensure(project, is.String) : "",
    };

    // スイッチャールールの取得
    const switcher = await getSwitcherRule(
      denops,
      normalizedParams.ruleName,
      normalizedParams.projectName,
    );

    if (!switcher) {
      console.log("No switch rule found.");
      return false;
    }

    // ファイル切り替えの実行
    return await switchByFileRule(denops, switcher);
  } catch (_e) {
    return false;
  }
}

export async function selectSwitchRule(denops: Denops, name?: unknown): Promise<void> {
  // スイッチルールの取得
  const switcher = await getSwitcherRule(
    denops,
    ensure("file", is.String),
    ensure(name ?? "", is.String),
  );

  if (!switcher) {
    console.log("No switch rule found.");
    return;
  }

  // パスの整形処理
  const formatPath = (path: string, index: number): string => {
    const fileName = path.split("/").pop();
    return `[${index}]: \`${fileName}\` path: ${path}`;
  };

  // パス一覧の作成
  const paths = ensure(switcher.path, is.ArrayOf(is.String));
  const formattedPaths = paths.map(formatPath);

  // バッファの作成と表示
  const bufnr = ensure(
    await n.nvim_create_buf(denops, false, true),
    is.Number,
  );
  await openFloatingWindow(denops, bufnr, formattedPaths);
}


