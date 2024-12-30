import md2sb from 'md2sb';

export async function convertMarkdownToScrapbox(markdown: string): Promise<string> {
  try {
    // md2sbを関数として直接呼び出し
    return await md2sb.default(markdown);
  } catch (error) {
    console.error('Markdown conversion error:', error);
    // フォールバック変換
    return markdown
      .split('\n')
      .map(line => {
        if (line.startsWith('#')) {
          return line.replace(/^#+\s/, '[* ') + ']';
        }
        if (line.startsWith('*')) {
          return line.replace(/^\*\s/, ' ');
        }
        return line;
      })
      .join('\n');
  }
}
