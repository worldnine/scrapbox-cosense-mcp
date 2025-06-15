import { convertMarkdownToScrapbox } from '@/utils/markdown-converter.js';

// md2sbライブラリをモック
jest.mock('md2sb', () => ({
  default: jest.fn()
}));

describe('convertMarkdownToScrapbox - 数字付きリスト変換', () => {
  let mockMd2sb: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const md2sbModule = require('md2sb');
    mockMd2sb = md2sbModule.default;
  });

  describe('数字付きリストの変換', () => {
    test('シンプルな数字付きリストが箇条書きに変換される', async () => {
      const markdown = `1. First item
2. Second item
3. Third item`;
      
      const md2sbOutput = ` 1. First item
 2. Second item
 3. Third item
`;
      
      const expectedOutput = ` First item
 Second item
 Third item
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown, {
        convertNumberedLists: true
      });
      
      expect(result).toBe(expectedOutput);
    });

    test('ネストした数字付きリストが正しく変換される', async () => {
      const markdown = `1. Parent 1
   1. Child 1.1
   2. Child 1.2
2. Parent 2`;
      
      const md2sbOutput = ` 1. Parent 1
  1. Child 1.1
  2. Child 1.2
 2. Parent 2
`;
      
      const expectedOutput = ` Parent 1
  Child 1.1
  Child 1.2
 Parent 2
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown, {
        convertNumberedLists: true
      });
      
      expect(result).toBe(expectedOutput);
    });

    test('3層のネストが正しく処理される', async () => {
      const markdown = `1. Level 1
   1. Level 2
      1. Level 3
      2. Level 3 second`;
      
      const md2sbOutput = ` 1. Level 1
  1. Level 2
   1. Level 3
   2. Level 3 second
`;
      
      const expectedOutput = ` Level 1
  Level 2
   Level 3
   Level 3 second
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown, {
        convertNumberedLists: true
      });
      
      expect(result).toBe(expectedOutput);
    });

    test('装飾付きの数字付きリストが正しく変換される', async () => {
      const markdown = `1. **Bold item**
2. *Italic item*`;
      
      const md2sbOutput = ` 1. [* Bold item]
 2. [/ Italic item]
`;
      
      const expectedOutput = ` [* Bold item]
 [/ Italic item]
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown, {
        convertNumberedLists: true
      });
      
      expect(result).toBe(expectedOutput);
    });

    test('見出し付きの数字付きリストが正しく変換される', async () => {
      const markdown = `# Main Title

1. First item
2. Second item`;
      
      const md2sbOutput = `[**** Main Title]

 1. First item
 2. Second item
`;
      
      const expectedOutput = `[**** Main Title]

 First item
 Second item
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown, {
        convertNumberedLists: true
      });
      
      expect(result).toBe(expectedOutput);
    });

    test('デフォルトでは番号が残る', async () => {
      const markdown = `1. First item
2. Second item`;
      
      const md2sbOutput = ` 1. First item
 2. Second item
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBe(md2sbOutput);
    });
  });

  describe('複合ケース', () => {
    test('肉じゃがレシピのような複雑な構造が正しく変換される', async () => {
      const markdown = `# 肉じゃがの作り方

## 材料（4人分）

1. **主材料**
   1. 牛肉（薄切り）：200g
   2. じゃがいも：4個
2. **調味料**
   1. だし汁：300ml`;
      
      const md2sbOutput = `[**** 肉じゃがの作り方]

[*** 材料（4人分）]

 1. [* 主材料]
  1. 牛肉（薄切り）：200g
  2. じゃがいも：4個
 2. [* 調味料]
  1. だし汁：300ml
`;
      
      const expectedOutput = `[**** 肉じゃがの作り方]

[*** 材料（4人分）]

 [* 主材料]
  牛肉（薄切り）：200g
  じゃがいも：4個
 [* 調味料]
  だし汁：300ml
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown, {
        convertNumberedLists: true
      });
      
      expect(result).toBe(expectedOutput);
    });

    test('数字以外のリストは影響を受けない', async () => {
      const markdown = `- Bullet item
* Another bullet
+ Plus bullet`;
      
      const md2sbOutput = ` Bullet item
 Another bullet
 Plus bullet
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBe(md2sbOutput);
    });

    test('行頭以外の数字は影響を受けない', async () => {
      const markdown = `This is step 1. Not a list`;
      
      const md2sbOutput = `This is step 1. Not a list
`;

      mockMd2sb.mockResolvedValue(md2sbOutput);
      const result = await convertMarkdownToScrapbox(markdown);
      
      expect(result).toBe(md2sbOutput);
    });
  });
});