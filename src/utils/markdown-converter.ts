// md2sbモジュールのインポート - 型定義の問題を回避
import md2sbModule from 'md2sb';

export async function convertMarkdownToScrapbox(markdown: string): Promise<string> {
  // CommonJSモジュールの二重default構造を処理
  const md2sb = (md2sbModule as any).default || md2sbModule;
  
  if (typeof md2sb !== 'function') {
    throw new Error('md2sb module not loaded correctly: ' + typeof md2sb);
  }
  
  // md2sbを直接呼び出し、エラーは上位に伝播させる
  return await md2sb(markdown);
}
