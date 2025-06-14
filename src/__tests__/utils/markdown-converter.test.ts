import { convertMarkdownToScrapbox } from '@/utils/markdown-converter.js';

// md2sbライブラリをモック
jest.mock('md2sb', () => jest.fn());

describe('convertMarkdownToScrapbox', () => {
  let mockMd2sb: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // md2sbモジュールのモック
    mockMd2sb = require('md2sb') as jest.Mock;
  });

  describe('正常ケース', () => {
    test('基本的なMarkdownが変換されること', async () => {
      const markdown = '# Header\nContent';
      const expectedScrapbox = '[* Header]\nContent';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
      expect(mockMd2sb).toHaveBeenCalledTimes(1);
    });

    test('空文字列が変換されること', async () => {
      const markdown = '';
      const expectedScrapbox = '';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('複雑なMarkdownが変換されること', async () => {
      const markdown = `# Main Title

## Subtitle

- List item 1
- List item 2

[Link](https://example.com)

\`\`\`javascript
console.log('code');
\`\`\`

**Bold text** and *italic text*
`;

      const expectedScrapbox = `[* Main Title]

[** Subtitle]

 List item 1
 List item 2

[https://example.com Link]

\`console.log('code');\`

[** Bold text] and [/ italic text]
`;
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('特殊文字を含むMarkdownが変換されること', async () => {
      const markdown = '# Title with & < > " characters';
      const expectedScrapbox = '[* Title with & < > " characters]';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('マルチバイト文字を含むMarkdownが変換されること', async () => {
      const markdown = `# 日本語タイトル

これは日本語のコンテンツです。

- リスト項目１
- リスト項目２

[リンク](https://example.com)
`;

      const expectedScrapbox = `[* 日本語タイトル]

これは日本語のコンテンツです。

 リスト項目１
 リスト項目２

[https://example.com リンク]
`;
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('改行を含むMarkdownが変換されること', async () => {
      const markdown = 'Line 1\nLine 2\n\nLine 4';
      const expectedScrapbox = 'Line 1\nLine 2\n\nLine 4';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });
  });

  describe('エラーケース', () => {
    test('md2sbがエラーを投げた場合にエラーが伝播されること', async () => {
      const markdown = '# Header';
      const errorMessage = 'Conversion failed';
      
      mockMd2sb.mockRejectedValue(new Error(errorMessage));

      await expect(convertMarkdownToScrapbox(markdown)).rejects.toThrow(errorMessage);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('md2sbが文字列エラーを投げた場合にエラーが伝播されること', async () => {
      const markdown = '# Header';
      const errorMessage = 'String error';
      
      mockMd2sb.mockRejectedValue(errorMessage);

      await expect(convertMarkdownToScrapbox(markdown)).rejects.toBe(errorMessage);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('md2sbがnullを返した場合の処理', async () => {
      const markdown = '# Header';
      
      mockMd2sb.mockResolvedValue(null);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBeNull();
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('md2sbがundefinedを返した場合の処理', async () => {
      const markdown = '# Header';
      
      mockMd2sb.mockResolvedValue(undefined);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBeUndefined();
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });
  });

  describe('非同期処理', () => {
    test('非同期的に変換が実行されること', async () => {
      const markdown = '# Header';
      const expectedScrapbox = '[* Header]';
      
      // 遅延を伴う非同期処理をシミュレート
      mockMd2sb.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(expectedScrapbox), 10))
      );

      const startTime = Date.now();
      const result = await convertMarkdownToScrapbox(markdown);
      const endTime = Date.now();

      expect(result).toBe(expectedScrapbox);
      expect(endTime - startTime).toBeGreaterThanOrEqual(5);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('複数の変換要求が正しく処理されること', async () => {
      const markdowns = ['# Header 1', '# Header 2', '# Header 3'];
      const expectedResults = ['[* Header 1]', '[* Header 2]', '[* Header 3]'];
      
      markdowns.forEach((md, index) => {
        mockMd2sb.mockImplementationOnce(() => 
          Promise.resolve(expectedResults[index])
        );
      });

      const promises = markdowns.map(md => convertMarkdownToScrapbox(md));
      const results = await Promise.all(promises);

      expect(results).toEqual(expectedResults);
      expect(mockMd2sb).toHaveBeenCalledTimes(3);
      markdowns.forEach((md, index) => {
        expect(mockMd2sb).toHaveBeenNthCalledWith(index + 1, md);
      });
    });
  });

  describe('エッジケース', () => {
    test('非常に長いMarkdownが変換されること', async () => {
      const longMarkdown = 'a'.repeat(10000);
      const expectedScrapbox = 'converted_' + longMarkdown;
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(longMarkdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(longMarkdown);
    });

    test('制御文字を含むMarkdownが変換されること', async () => {
      const markdown = 'Text\twith\ttabs\nand\nnewlines\rand\rcarriage\freturns';
      const expectedScrapbox = 'Converted text with special chars';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });

    test('Unicode文字を含むMarkdownが変換されること', async () => {
      const markdown = '# 🎉 Emoji Title\n\n✅ Unicode bullet point\n\n🔗 [Link with emoji](https://example.com)';
      const expectedScrapbox = '[* 🎉 Emoji Title]\n\n✅ Unicode bullet point\n\n[https://example.com 🔗 Link with emoji]';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(result).toBe(expectedScrapbox);
      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
    });
  });

  describe('型安全性', () => {
    test('戻り値の型がstringであること', async () => {
      const markdown = '# Header';
      const expectedScrapbox = '[* Header]';
      
      mockMd2sb.mockResolvedValue(expectedScrapbox);

      const result = await convertMarkdownToScrapbox(markdown);

      expect(typeof result).toBe('string');
      expect(result).toBe(expectedScrapbox);
    });

    test('パラメータの型がstringであることを確認', async () => {
      const markdown = '# Header';
      
      mockMd2sb.mockResolvedValue('[* Header]');

      // TypeScriptコンパイラレベルでの型チェックを確認
      await convertMarkdownToScrapbox(markdown);

      expect(mockMd2sb).toHaveBeenCalledWith(markdown);
      expect(typeof mockMd2sb.mock.calls[0][0]).toBe('string');
    });
  });
});