import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";

/**
 * スイッチルールの種類を表す型
 */
export type RuleType = "file" | "git";

/**
 * プロジェクトの基本設定を表す型
 */
export interface Project {
  name?: string;
  rule: RuleType;
  path: string[];
  prefix?: string;
  postfix?: string;
}

/**
 * スイッチルールの設定を表す型
 */
export interface SwitchRule {
  projects: {
    name: string;
    rules: Project[];
  }[];
}

/**
 * コマンド定義を表す型
 */
export interface CommandDefinition {
  denops: Denops;
  command: string;
  method: string;
  args?: string;
  complete?: string;
}
