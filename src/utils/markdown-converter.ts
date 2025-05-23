import md2sb from 'md2sb';

export async function convertMarkdownToScrapbox(markdown: string): Promise<string> {
  // md2sbを直接呼び出し、エラーは上位に伝播させる
  return await md2sb(markdown);
}
