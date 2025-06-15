// md2sbモジュールのインポート - 型定義の問題を回避
import md2sbModule from 'md2sb';

/**
 * 数字付きリストを箇条書き形式に変換
 * 例: " 1. item" → " item"
 */
function convertNumberedListToBullet(text: string | null | undefined): string {
  if (text == null) {
    return '';
  }
  // 行頭のスペース + 数字 + ピリオド + スペースを、スペースのみに置換
  // $1でインデントのスペースを保持
  return text.replace(/^(\s+)\d+\.\s/gm, '$1');
}

/**
 * 最初の見出し行を除去（タイトル重複回避用）
 * 例: "[**** タイトル]\n\n本文" → "本文"
 */
function removeFirstHeading(text: string | null | undefined): string {
  if (text == null) {
    return '';
  }
  // Scrapbox形式の見出し（[* ...]から[**** ...]まで）を除去
  // 見出しの後の改行も含めて除去
  return text.replace(/^\[\*+\s[^\]]+\]\n\n?/, '');
}

export async function convertMarkdownToScrapbox(
  markdown: string,
  options?: {
    convertNumberedLists?: boolean;
    removeTitle?: boolean;
  }
): Promise<string> {
  // デフォルトオプション
  const opts = {
    convertNumberedLists: options?.convertNumberedLists ?? true,
    removeTitle: options?.removeTitle ?? false,
    ...options
  };

  // CommonJSモジュールの二重default構造を処理
  const md2sb = (md2sbModule as any).default || md2sbModule;
  
  if (typeof md2sb !== 'function') {
    throw new Error('md2sb module not loaded correctly: ' + typeof md2sb);
  }
  
  // md2sbを使用してマークダウンをScrapbox形式に変換
  let result = await md2sb(markdown);
  
  // md2sbがnullまundefinedを返した場合の処理
  if (result == null) {
    return '';
  }
  
  // 文字列以外の場合は文字列に変換
  if (typeof result !== 'string') {
    result = String(result);
  }
  
  // 数字付きリストを箇条書きに変換（オプション）
  if (opts.convertNumberedLists) {
    result = convertNumberedListToBullet(result);
  }
  
  // タイトル行を除去（オプション）
  if (opts.removeTitle) {
    result = removeFirstHeading(result);
  }
  
  return result;
}
