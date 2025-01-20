import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";
import type { Project } from "./type.ts";

/**
 * Opens a file in the editor
 *
 * @param denops Denops instance
 * @param filePath Path to the file to open
 * @returns Promise<boolean> Success status
 */
export async function openFile(
  denops: Denops,
  filePath: string | undefined,
): Promise<boolean> {
  if (!filePath) return false;
  await denops.cmd(`:e ${filePath}`);
  return true;
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
  let baseName = fileName;
  if (project.postfix && baseName.endsWith(project.postfix)) {
    baseName = baseName.replace(project.postfix, "");
  }
  if (project.prefix && baseName.startsWith(project.prefix)) {
    baseName = baseName.replace(project.prefix, "");
  }
  return baseName;
} 