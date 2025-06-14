// @ts-ignore - md2sb has incorrect type definitions
import * as md2sbModule from 'md2sb';

const md2sb = (md2sbModule as any).default || md2sbModule;

export async function convertMarkdownToScrapbox(markdown: string): Promise<string> {
  // md2sbを直接呼び出し、エラーは上位に伝播させる
  return await md2sb(markdown);
}
