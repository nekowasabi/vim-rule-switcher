import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import { addRule, getSwitcherRule, switchByFileRule } from "./switcher.ts";
import type { CommandDefinition } from "./type.ts";
import { openFloatingWindow } from "./ui.ts";

const NO_RULE_MESSAGE = "No switch rule found.";

type Dispatcher = {
  selectSwitchRule(name?: unknown): Promise<void>;
  openSelectedFile(index: unknown): Promise<void>;
  saveSwitchRule(name: unknown): Promise<void>;
  switchByRule(rule: unknown, project: unknown): Promise<boolean>;
  openSwitchRule(): Promise<void>;
};

/**
 * ファイルパスから表示用のラベルを生成する
 *
 * @param {string} path - ファイルパス
 * @param {number} index - ファイルのインデックス
 * @returns {string} 表示用のラベル
 */
function createPathLabel(path: string, index: number): string {
  const fileName = path.split("/").pop() ?? path;
  return `[${index}]: \`${fileName}\` path: ${path}`;
}

/**
 * フローティングウィンドウを作成し、パスリストを表示する
 *
 * @param {Denops} denops - Denopsオブジェクト
 * @param {string[]} paths - ファイルパスのリスト
 */
async function createFloatingWindowWithPaths(
  denops: Denops,
  paths: string[],
): Promise<void> {
  const pathLabels = paths.map((p, i) => createPathLabel(p, i));
  const bufnr = ensure(await n.nvim_create_buf(denops, false, true), is.Number);
  await openFloatingWindow(denops, bufnr, pathLabels);
}

/**
 * 選択されたパスを解析して取得する
 *
 * @param {string} line - 選択されたパスを含む行
 * @returns {string | undefined} 選択されたパス
 */
function parseSelectedPath(line: string): string | undefined {
  return line.split("path: ").at(-1);
}

/**
 * Vimコマンドを定義する
 */
async function defineCommand({
  denops,
  command,
  method,
  args = "",
  complete = "",
}: CommandDefinition): Promise<void> {
  let cmd = `command! ${args} ${command} call denops#notify("${denops.name}", "${method}", [<f-args>])`;
  if (complete) {
    cmd = cmd.replace(args, `${args} -complete=${complete}`);
  }
  await denops.cmd(cmd);
}

export async function main(denops: Denops): Promise<void> {
  const dispatcher: Dispatcher = {
    /**
     * floating windowで選択肢を表示する
     * @param name - フィルタリングするルールの名前（オプション）
     * @throws {SwitcherError} ルールが見つからない場合
     **/
    async selectSwitchRule(name?: unknown): Promise<void> {
      try {
        const switcher = await getSwitcherRule(
          denops,
          ensure("file", is.String),
          ensure(name ?? "", is.String),
        );

        if (!switcher) {
          console.log(NO_RULE_MESSAGE);
          return;
        }

        const path = ensure(switcher.path, is.ArrayOf(is.String));
        await createFloatingWindowWithPaths(denops, path);
      } catch (error) {
        const e = error as Error;
        console.error(`Error in openSelectedFile: ${e.message}`);
      }
    },

    /**
     * 選択されたファイルを開く
     * @param index - 選択されたファイルのインデックス
     * @throws {SwitcherError} ファイルが見つからない場合
     **/
    async openSelectedFile(index: unknown): Promise<void> {
      try {
        const validIndex = ensure(index, is.Number);
        const bufnr = ensure(await n.nvim_get_current_buf(denops), is.Number);
        const lines = ensure(
          await n.nvim_buf_get_lines(denops, bufnr, 0, -1, false),
          is.ArrayOf(is.String),
        );

        const selectedLine = lines.find((line) =>
          line.startsWith(`[${validIndex}]`),
        );
        if (!selectedLine) return;

        const filePath = parseSelectedPath(selectedLine);
        if (!filePath) return;

        await denops.cmd("fclose!");
        await denops.cmd(`e ${filePath}`);
      } catch (error) {
        const e = error as Error;
        console.error(`Error in openSelectedFile: ${e.message}`);
      }
    },

    /**
     * スイッチルールを保存する
     * @param name - 保存するルールの名前
     **/
    async saveSwitchRule(name: unknown): Promise<void> {
      try {
        await addRule(denops, ensure(name, is.String));
      } catch (error) {
        const e = error as Error;
        console.error(`Error in openSelectedFile: ${e.message}`);
      }
    },

    /**
     * ルールに基づいてファイルを切り替える
     * @param rule - ルール名
     * @param project - プロジェクト名
     * @returns 切り替えが成功したかどうか
     **/
    async switchByRule(rule: unknown, project: unknown): Promise<boolean> {
      try {
        const ruleName = ensure(rule ?? "file", is.String);
        const projectName = ensure(project ?? "", is.String);
        const switcher = await getSwitcherRule(denops, ruleName, projectName);

        if (!switcher) {
          console.log(NO_RULE_MESSAGE);
          return false;
        }

        return await switchByFileRule(denops, switcher);
      } catch (error) {
        const e = error as Error;
        console.error(`Error in openSelectedFile: ${e.message}`);
        return false;
      }
    },

    /**
     * ファイル切り替え定義ファイルを開く
     * @throws {SwitcherError} ルールが見つからない場合
     **/
    async openSwitchRule(): Promise<void> {
      try {
        if (!(await v.g.get(denops, "switch_rule"))) {
          console.log(NO_RULE_MESSAGE);
          return;
        }

        const path = ensure(await v.g.get(denops, "switch_rule"), is.String);
        await denops.cmd(`edit ${path}`);
      } catch (error) {
        const e = error as Error;
        console.error(`Error in openSelectedFile: ${e.message}`);
      }
    },
  };

  denops.dispatcher = dispatcher;

  // コマンド定義
  const commands: CommandDefinition[] = [
    {
      denops,
      command: "SwitchFileByRule",
      method: "switchByRule",
      args: "-nargs=*",
    },
    {
      denops,
      command: "OpenSwitchRule",
      method: "openSwitchRule",
      args: "-nargs=0",
    },
    {
      denops,
      command: "SaveSwitchRule",
      method: "saveSwitchRule",
      args: "-nargs=1",
    },
    {
      denops,
      command: "SelectSwitchRule",
      method: "selectSwitchRule",
      args: "-nargs=?",
      complete: "customlist,GetRulesName",
    },
  ];

  for (const command of commands) {
    await defineCommand(command);
  }
}
