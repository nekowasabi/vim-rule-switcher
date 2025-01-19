/**
 * スイッチルールの種類を表す型
 */
export type RuleType = "file" | "git";

/**
 * プロジェクトの基本設定を表す型
 */
export type ProjectBase = {
  name?: string;
  postfix?: string;
  prefix?: string;
};

/**
 * パスの設定を表す型
 */
export type PathConfig = {
  path: string[];
};

/**
 * プロジェクトの設定を表す型
 */
export type Project = ProjectBase &
  PathConfig & {
    rule: RuleType;
  };

/**
 * ルールの設定を表す型
 */
export type Rule = {
  rule: RuleType;
} & PathConfig;

/**
 * スイッチルールの設定を表す型
 */
export type SwitchRule = {
  projects: Array<{
    name: string;
    rules: Array<Rule>;
  }>;
}; 