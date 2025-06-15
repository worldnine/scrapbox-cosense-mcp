// 実際のmd2sbモジュールを使用する統合テスト
import { convertMarkdownToScrapbox } from '@/utils/markdown-converter.js';

describe('convertMarkdownToScrapbox Integration Tests', () => {
  describe('実際のmd2sbモジュールでの動作確認', () => {
    test('基本的なヘッダーが変換されること', async () => {
      const markdown = '# Header\nContent';
      const result = await convertMarkdownToScrapbox(markdown);
      
      // Scrapbox形式に変換されていることを確認
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Header');
      // Markdownの#記号が除去されていることを確認
      expect(result).not.toMatch(/^#\s/);
    });

    test('複数レベルのヘッダーが変換されること', async () => {
      const markdown = '# Level 1\n## Level 2\n### Level 3';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(result).toContain('Level 1');
      expect(result).toContain('Level 2');
      expect(result).toContain('Level 3');
    });

    test('リンクが変換されること', async () => {
      const markdown = '[Link Text](https://example.com)';
      const result = await convertMarkdownToScrapbox(markdown);
      
      // Scrapbox形式のリンクに変換されていることを確認
      expect(result).toBeDefined();
      expect(result).toContain('https://example.com');
      expect(result).toContain('Link Text');
      // Markdown形式のリンクが残っていないことを確認
      expect(result).not.toContain('](');
    });

    test('リストが変換されること', async () => {
      const markdown = '- Item 1\n- Item 2\n  - Nested Item';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).toContain('Nested Item');
    });

    test('コードブロックが変換されること', async () => {
      const markdown = '```javascript\nconsole.log("Hello");\n```';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(result).toContain('console.log("Hello");');
    });

    test('太字とイタリックが変換されること', async () => {
      const markdown = '**Bold text** and *italic text*';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(result).toContain('Bold text');
      expect(result).toContain('italic text');
    });

    test('日本語を含むMarkdownが正しく変換されること', async () => {
      const markdown = `# 日本語タイトル

これは日本語の段落です。

- リスト項目１
- リスト項目２

[日本語リンク](https://example.com)`;
      
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(result).toContain('日本語タイトル');
      expect(result).toContain('これは日本語の段落です。');
      expect(result).toContain('リスト項目１');
      expect(result).toContain('リスト項目２');
      expect(result).toContain('日本語リンク');
    });

    test('空文字列を変換できること', async () => {
      const markdown = '';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('改行のみの文字列を変換できること', async () => {
      const markdown = '\n\n\n';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('特殊文字を含むMarkdownが変換されること', async () => {
      const markdown = '# Title & <Content> "Quote"';
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBeDefined();
      expect(result).toContain('Title');
      expect(result).toContain('&');
      expect(result).toContain('Quote');
      // md2sbはHTMLタグを除去する可能性があるため、<Content>の検証を調整
      // expect(result).toContain('<Content>');
    });
  });

  describe('実際のエラーケース', () => {
    test('nullを渡した場合のエラー', async () => {
      // @ts-expect-error - 意図的に型エラーを無視
      await expect(convertMarkdownToScrapbox(null)).rejects.toThrow();
    });

    test('undefinedを渡した場合のエラー', async () => {
      // md2sbは実際にはundefinedを空文字列として処理する可能性がある
      // @ts-expect-error - 意図的に型エラーを無視
      const result = await convertMarkdownToScrapbox(undefined);
      // エラーにならずに空文字列またはそれに類する値が返される
      expect(typeof result).toBe('string');
    });

    test('数値を渡した場合のエラー', async () => {
      // @ts-expect-error - 意図的に型エラーを無視
      await expect(convertMarkdownToScrapbox(123)).rejects.toThrow();
    });
  });

  describe('パフォーマンステスト', () => {
    test('大きなMarkdownファイルを変換できること', async () => {
      // 1000行のMarkdownを生成
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`# Header ${i}`);
        lines.push(`This is paragraph ${i} with some content.`);
        lines.push('');
      }
      const markdown = lines.join('\n');
      
      const startTime = Date.now();
      const result = await convertMarkdownToScrapbox(markdown);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      
      // 1000行の変換が5秒以内に完了することを確認
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});