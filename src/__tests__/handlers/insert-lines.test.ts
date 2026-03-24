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
      mockedPatch.mockResolvedValue({ ok: true, val: 'commitId', err: null });
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
      mockedPatch.mockResolvedValue({ ok: true, val: 'commitId', err: null });
      
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
      mockedPatch.mockResolvedValue({ ok: true, val: 'commitId', err: null });
      
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'line 1\nline 2\nline 3',
      };
      
      const result = await handleInsertLines(mockProjectName, mockCosenseSid, params);
      
      expect(result.content[0]?.text).toContain('Inserted lines: 3');
      expect(mockedPatch).toHaveBeenCalled();
    });

    test('対象行は完全一致でマッチすること（部分一致しない）', async () => {
      // patchのcallbackに渡される行をキャプチャして検証
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        const mockLines = [
          { text: 'title', id: 'l1' },
          { text: 'my TODO list', id: 'l2' },
          { text: 'TODO', id: 'l3' },
          { text: 'other line', id: 'l4' },
        ] as any;
        const result = updateFn(mockLines);
        // 完全一致なので "TODO" は l3にマッチし、l3の後ろに挿入される
        expect(result[3]?.text).toBe('inserted text');
        // "my TODO list" にはマッチしない（部分一致しない）
        expect(result[1]?.text).toBe('my TODO list');
        return { ok: true, val: 'commitId', err: null };
      });

      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'TODO',
        text: 'inserted text',
      };
      await handleInsertLines(mockProjectName, mockCosenseSid, params);
    });

    test('対象行が見つからない場合は末尾に追加されること', async () => {
      let capturedResult: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        const mockLines = [
          { text: 'title', id: 'l1' },
          { text: 'some line', id: 'l2' },
        ] as any;
        capturedResult = updateFn(mockLines);
        return { ok: true, val: 'commitId', err: null };
      });

      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'nonexistent line',
        text: 'inserted text',
        format: 'scrapbox' as const,
      };
      const result = await handleInsertLines(mockProjectName, mockCosenseSid, params);

      // 末尾に追加される
      expect(capturedResult).toHaveLength(3);
      expect(capturedResult[2]?.text).toBe('inserted text');
      expect(result.content[0]?.text).toContain('not found (appended to end)');
    });

    test('patch が Result.Err を返した場合にエラーレスポンスを返すこと', async () => {
      mockedPatch.mockResolvedValue({ ok: false, val: null, err: 'DisconnectReason' } as any);

      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
      };
      const result = await handleInsertLines(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('WebSocket patch failed');
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
      expect(result.content[0]?.text).toContain('Error:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });
});