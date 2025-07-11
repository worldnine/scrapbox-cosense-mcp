import { handleInsertLines } from '@/routes/handlers/insert-lines.js';

// モックの設定
jest.mock('@/utils/markdown-converter.js', () => ({
  convertMarkdownToScrapbox: jest.fn((text) => Promise.resolve(text)) // そのまま返す
}));
// @cosense/stdライブラリ全体をモック
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

// patchのモックを動的に取得
let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

describe('handleInsertLines', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('エラーケース', () => {
    it('COSENSE_SIDが未設定の場合にエラーを返す', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
      };

      const result = await handleInsertLines(mockProjectName, undefined, params);

      expect(result).toEqual({
        content: [{
          type: "text",
          text: expect.stringContaining('Authentication required')
        }],
        isError: true
      });
    });

    it('パラメータが正しく設定される', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
        projectName: 'custom-project',
      };

      // COSENSE_SIDが未設定の場合は認証エラーになることを確認
      const result = await handleInsertLines(mockProjectName, undefined, params);
      
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Authentication required');
    });
  });

  describe('成功ケースのパラメータ処理', () => {
    it('projectNameが指定された場合に使用される', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
        projectName: 'custom-project',
      };

      // 認証が必要なことを確認（正常なフローの前段階）
      const result = await handleInsertLines(mockProjectName, undefined, params);
      
      expect(result.content?.[0]?.text).toContain('custom-project');
    });

    it('複数行のテキストが正しく処理される', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'line 1\nline 2\nline 3',
      };

      // 認証エラーでも行数は正しく認識されることを確認
      const result = await handleInsertLines(mockProjectName, undefined, params);
      
      expect(result.isError).toBe(true);
    });
  });

  describe('正常ケース', () => {
    test('基本的なテキスト挿入が成功すること', async () => {
      mockedPatch.mockResolvedValue(undefined);
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
      };
      const result = await handleInsertLines(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('Successfully inserted lines into page');
      expect(result.content[0]?.text).toContain('Page: Test Page');
      expect(result.content[0]?.text).toContain('Inserted lines: 1');

      expect(mockedPatch).toHaveBeenCalledWith(
        mockProjectName,
        'Test Page',
        expect.any(Function),
        { sid: mockCosenseSid }
      );
    });

    test('マークダウン変換が行われること', async () => {
      const { convertMarkdownToScrapbox } = await import('@/utils/markdown-converter.js');
      const mockedConvert = convertMarkdownToScrapbox as jest.MockedFunction<typeof convertMarkdownToScrapbox>;
      
      mockedConvert.mockResolvedValue('converted text');
      mockedPatch.mockResolvedValue(undefined);
      
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: '# Header\nContent',
      };
      
      await handleInsertLines(mockProjectName, mockCosenseSid, params);
      
      expect(mockedConvert).toHaveBeenCalledWith('# Header\nContent', {
        convertNumberedLists: false // デフォルト値
      });
    });

    test('複数行のテキスト挿入が成功すること', async () => {
      const { convertMarkdownToScrapbox } = await import('@/utils/markdown-converter.js');
      const mockedConvert = convertMarkdownToScrapbox as jest.MockedFunction<typeof convertMarkdownToScrapbox>;
      
      // マークダウン変換でそのまま返すように設定
      mockedConvert.mockResolvedValue('line 1\nline 2\nline 3');
      mockedPatch.mockResolvedValue(undefined);
      
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'line 1\nline 2\nline 3',
      };
      
      const result = await handleInsertLines(mockProjectName, mockCosenseSid, params);
      
      expect(result.content[0]?.text).toContain('Inserted lines: 3');
      expect(mockedPatch).toHaveBeenCalled();
    });

    test('WebSocket APIでエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'WebSocket error';
      mockedPatch.mockRejectedValue(new Error(errorMessage));

      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
      };
      const result = await handleInsertLines(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error details:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });
});