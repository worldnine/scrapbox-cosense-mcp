/**
 * 操作対象プロジェクトの制限（`COSENSE_PROJECT_ALLOW_LIST`）。
 *
 * 全ツールはパラメータで `projectName` の上書きを受け付ける。マルチプロジェクトを扱うための
 * 意図的な仕様だが、SID が届く範囲は既定プロジェクトより広いことが多く、LLM が誤って別の
 * プロジェクトを指したときの歯止めが無い。
 *
 * 未設定なら従来どおり無制限（後方互換）。`COSENSE_ENABLE_DELETE` と同じく、絞りたい人だけ
 * 絞るオプトインの安全策で、環境変数は呼び出しごとに読む。
 */

/**
 * 許可リストを環境変数から読む。**未設定のときだけ** undefined（＝無制限）。
 *
 * 設定されていれば、トリム後に名前が1つも残らなくても（`""` や `",,,"`）空配列を返して
 * 制限モードに入る。変数を書いた人は制限したい意図なので、「設定したつもりで無制限」より
 * 「既定プロジェクトだけ許可」に倒すほうが安全なため。
 */
export function getProjectAllowList(): string[] | undefined {
  const raw = process.env.COSENSE_PROJECT_ALLOW_LIST;
  if (raw === undefined) return undefined;
  // カンマ区切りの各要素は前後の空白をトリムし、空要素は無視する
  return raw.split(',').map(name => name.trim()).filter(Boolean);
}

/**
 * 暗黙に許可される既定プロジェクト。
 *
 * ハンドラが受け取る `defaultProjectName` ではなく環境変数を見る。CLI は `--project=NAME` の
 * 値をそのまま `defaultProjectName` としてハンドラに渡すため、引数を基準にすると
 * 「指定した名前＝既定」が常に成立して、許可リストが素通りになる。
 */
function getDefaultProjectName(): string | undefined {
  return process.env.COSENSE_PROJECT_NAME?.trim() || undefined;
}

/**
 * 指定されたプロジェクトが許可されているか判定する。
 * 既定プロジェクト（`COSENSE_PROJECT_NAME`）は暗黙にリストに含まれる扱い。
 *
 * 照合は大文字小文字を区別する。Scrapbox のページ解決は寛容だが、ここまで寛容にすると
 * 表記違いで許可外のプロジェクトが通ってしまうため。
 */
export function isProjectAllowed(projectName: string): boolean {
  const allowList = getProjectAllowList();
  if (!allowList) return true;
  if (projectName === getDefaultProjectName()) return true;
  return allowList.includes(projectName);
}

/**
 * 拒否時のメッセージ。許可済みの一覧をそのまま見せる — 隠しても攻撃者には効かず、
 * 設定ミスを直す人が困るだけなので。
 */
export function projectNotAllowedMessage(projectName: string): string {
  const defaultProjectName = getDefaultProjectName();
  // 既定プロジェクトは暗黙に許可されるので、案内にも含めないと嘘になる
  const permitted = [
    ...(defaultProjectName ? [defaultProjectName] : []),
    ...(getProjectAllowList() ?? []),
  ];
  const unique = permitted.filter((name, index) => permitted.indexOf(name) === index);
  // 実質空の許可リストで COSENSE_PROJECT_NAME も無いと、許可されるものが1つも無い
  const listed = unique.length > 0 ? unique.join(', ') : '(none)';
  return `Project '${projectName}' is not allowed by COSENSE_PROJECT_ALLOW_LIST. Permitted projects: ${listed}`;
}

/**
 * 許可されていなければエラーメッセージ、許可されていれば undefined を返す。
 *
 * 例外ではなく戻り値にしてあるのは、プロジェクト名を `try` の外で解決しているハンドラが
 * あるため。投げるとそこだけ catch されない。呼び出し側は受け取った文字列を
 * それぞれの `formatError` に載せる。
 */
export function checkProjectAllowed(projectName: string): string | undefined {
  if (isProjectAllowed(projectName)) return undefined;
  return projectNotAllowedMessage(projectName);
}
