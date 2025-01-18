import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import { ensure, is, maybe } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

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
export async function getSwitchers(denops: Denops): Promise<NewSwitchRule> {
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
  const settings: NewSwitchRule = JSON.parse(file);

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


  if (project.rule === "file") {
    const currentPath = ensure(await getCurrentFileRealPath(denops), is.String);
    const filePathToOpen = getNextFilePath(currentPath, project.path);

    if (filePathToOpen === undefined) {
      return false;
    }

    await denops.cmd(`:e ${filePathToOpen}`);
    return true;
  }

  if (project.rule === "git") {
    const currentFileName = ensure(await getCurrentFileName(denops), is.String);
    const filePathToOpen = getNextFilePath(currentFileName, project.path);

    if (filePathToOpen === undefined) {
      return false;
    }

    const result = ensure(await denops.call("system", "git ls-files"), is.String);
    const files = result.split("\n");
    const targetFile = files.find((file) => file.includes(filePathToOpen));
    const realPath = Deno.realPathSync(ensure(targetFile, is.String));

    if (!realPath) {
      console.log("No switch rule found.");
      return false;
    }

    await denops.cmd(`:e ${realPath}`);
    return true;
  }

  return false;
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

export type SwitchRule = {
  conditions: {
    name?: string;
    rule: string;
    path: string[];
  }[];
};

export type Project = {
  name?: string;
  path: string[];
  rule: string;
  postfix?: string;
  prefix?: string;
};

export type NewSwitchRule = {
  projects: {
    name: string;
    rules: {
      rule: string;
      path: string[];
    }[];
  }[];
};

/**
 * Add a new rule to the existing switch rules
 *
 * @param {Denops} denops - Denops instance
 * @param {string} projectName - Name of the new rule
 * @returns {Promise<void>}
 */
export async function addRule(denops: Denops, projectName: string): Promise<void> {
  const switchRulePath = ensure(await v.g.get(denops, "switch_rule"), is.String);
  const switchRules: NewSwitchRule = JSON.parse(await Deno.readTextFile(switchRulePath));

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

export async function openFloatingWindow(denops: Denops, bufnr: number, pathWithIndex: string[]): Promise<void> {
  const terminal_width = Math.floor(ensure(await n.nvim_get_option(denops, "columns"), is.Number));
  const terminal_height = Math.floor(ensure(await n.nvim_get_option(denops, "lines"), is.Number));
  const floatWinHeight = pathWithIndex.length;
  const floatWinWidth = maybe(await v.g.get(denops, "aider_floatwin_width"), is.Number) || 100;

  const row = Math.floor((terminal_height - floatWinHeight) / 2);
  const col = Math.floor((terminal_width - floatWinWidth) / 2);

  await n.nvim_open_win(denops, bufnr, true, {
    relative: "editor",
    border: "double",
    width: floatWinWidth,
    height: floatWinHeight,
    row: row,
    col: col,
  });

  await n.nvim_buf_set_lines(denops, bufnr, 0, 0, true, pathWithIndex);
  await denops.cmd("normal! gg");
  await denops.cmd("set nonumber");
  await n.nvim_buf_set_option(denops, bufnr, "modifiable", false);
  await n.nvim_buf_set_option(denops, bufnr, "wrap", false);
  await n.nvim_buf_set_option(denops, bufnr, "buftype", "nofile");

  // 1-9のキーマッピングを設定
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

  // oでカーソル行のファイルを開く
  await n.nvim_buf_set_keymap(
    denops,
    bufnr,
    "n",
    "o",
    "<cmd>call denops#notify('switcher', 'openSelectedFile', [line('.') - 1])<CR>",
    { silent: true }
  );

  // 閉じる
  await n.nvim_buf_set_keymap(denops, bufnr, "n", "q", "<cmd>fclose!<CR>", {
    silent: true,
  });

}


