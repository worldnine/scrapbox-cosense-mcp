import { handleRewritePage } from '@/routes/handlers/rewrite-page.js';
import * as cosense from '@/cosense.js';

jest.mock('@/cosense.js');
jest.mock('@/utils/markdown-converter.js', () => ({
  convertMarkdownToScrapbox: jest.fn((text) => Promise.resolve(text))
}));
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

function mockPage(lines: string[], persistent = true) {
  return {
    id: 'page-id',
    title: lines[0] ?? '',
    lines: lines.map((text, i) => ({
      id: `line-${i}`,
      text,
      userId: 'user-id',
      created: 0,
      updated: 0,
    })),
    persistent,
    collaborators: [],
  } as unknown as Awaited<ReturnType<typeof cosense.getPage>>;
}

describe('handleRewritePage', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';
  const originalEnableDelete = process.env.COSENSE_ENABLE_DELETE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COSENSE_ENABLE_DELETE = 'true';
    mockedCosense.getPage.mockResolvedValue(mockPage(['Test Page', 'line 1', 'line 2']));
    mockedPatch.mockResolvedValue({ ok: true, val: 'commitId', err: null });
  });

  afterAll(() => {
    if (originalEnableDelete === undefined) {
      delete process.env.COSENSE_ENABLE_DELETE;
    } else {
      process.env.COSENSE_ENABLE_DELETE = originalEnableDelete;
    }
  });

  describe('環境変数によるゲート', () => {
    test('COSENSE_ENABLE_DELETEが未設定の場合はエラーを返し、patchを呼ばないこと', async () => {
      delete process.env.COSENSE_ENABLE_DELETE;

      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new content',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('COSENSE_ENABLE_DELETE');
      expect(mockedPatch).not.toHaveBeenCalled();
    });
  });

  describe('認証', () => {
    test('COSENSE_SIDが未設定の場合に認証エラーを返すこと', async () => {
      const result = await handleRewritePage(mockProjectName, undefined, {
        pageTitle: 'Test Page',
        body: 'new content',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Authentication required');
      expect(mockedPatch).not.toHaveBeenCalled();
    });
  });

  describe('空内容の拒否', () => {
    test('bodyが空文字の場合はエラーになること', async () => {
      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: '',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Empty content');
      expect(mockedPatch).not.toHaveBeenCalled();
    });

    test('bodyが文字列でない場合も空内容と同じエラーになること', async () => {
      // MCP スキーマは string を要求するが、スキーマ検証をしないクライアントに備える
      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 42 as unknown as string,
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Empty content');
      expect(mockedPatch).not.toHaveBeenCalled();
    });

    test('bodyが空白のみの場合もエラーになること', async () => {
      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: '   \n  ',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Empty content');
      expect(mockedPatch).not.toHaveBeenCalled();
    });
  });

  describe('存在チェック', () => {
    test('getPageがnullを返す場合はエラーになり、patchを呼ばないこと', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Missing Page',
        body: 'new content',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Page not found');
      expect(mockedPatch).not.toHaveBeenCalled();
    });

    test('persistentがfalseの場合はエラーになること', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPage(['Missing Page'], false));

      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Missing Page',
        body: 'new content',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Page not found');
      expect(mockedPatch).not.toHaveBeenCalled();
    });
  });

  describe('ドライラン', () => {
    test('dryRunがtrueの場合はpatchを呼ばず、before/afterを返すこと', async () => {
      mockedCosense.getPage.mockResolvedValue(
        mockPage(['Test Page', 'old 1', 'old 2'])
      );

      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new 1\nnew 2',
        format: 'scrapbox',
        dryRun: true,
      });

      expect(mockedPatch).not.toHaveBeenCalled();
      const text = result.content?.[0]?.text ?? '';
      expect(text).toContain('Dry run: no changes were made');
      expect(text).toContain('Current lines: 3');
      expect(text).toContain('old 1');
      expect(text).toContain('New lines: 3');
      expect(text).toContain('new 1');
    });

    test('compactモードのドライランでは短いメッセージを返すこと', async () => {
      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new 1',
        format: 'scrapbox',
        dryRun: true,
        compact: true,
      });

      expect(mockedPatch).not.toHaveBeenCalled();
      expect(result.content?.[0]?.text).toBe('dry-run: Test Page (3 -> 2 lines)');
    });
  });

  describe('書き換え', () => {
    test('タイトルを先頭行として残し、本文を置き換えること', async () => {
      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new 1\nnew 2',
        format: 'scrapbox',
      });

      expect(mockedPatch).toHaveBeenCalledWith(
        mockProjectName,
        'Test Page',
        expect.any(Function),
        { sid: mockCosenseSid }
      );

      const callback = mockedPatch.mock.calls[0]?.[2] as (lines: unknown[]) => unknown[];
      expect(callback([])).toEqual([
        { text: 'Test Page' },
        { text: 'new 1' },
        { text: 'new 2' },
      ]);

      const text = result.content?.[0]?.text ?? '';
      expect(text).toContain('Successfully rewrote page');
      expect(text).toContain('Previous lines: 3');
      expect(text).toContain('New lines: 3');
    });

    test('タイトルは呼び出し側の表記ではなく実際のタイトルを使うこと', async () => {
      // Scrapbox のページ解決は大文字小文字に寛容なため、pageTitle の表記で
      // 先頭行を作ると黙ってリネームされる。実際のタイトルを使うべき。
      mockedCosense.getPage.mockResolvedValue(mockPage(['Test Page', 'line 1']));

      await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'test page',
        body: 'new 1',
        format: 'scrapbox',
      });

      const callback = mockedPatch.mock.calls[0]?.[2] as (lines: unknown[]) => unknown[];
      expect(callback([])).toEqual([
        { text: 'Test Page' },
        { text: 'new 1' },
      ]);
    });

    test('format 未指定時は markdown 変換が呼ばれること', async () => {
      const { convertMarkdownToScrapbox } = await import('@/utils/markdown-converter.js');
      const mockedConvert = convertMarkdownToScrapbox as jest.MockedFunction<typeof convertMarkdownToScrapbox>;
      mockedConvert.mockResolvedValue('converted body');

      mockedCosense.getPage.mockResolvedValue(mockPage(['Test Page', 'line 1']));
      await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: '# header',
      });

      expect(mockedConvert).toHaveBeenCalledWith('# header', {
        convertNumberedLists: false,
      });
    });

    test('projectNameの指定が既定のプロジェクトより優先されること', async () => {
      await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new 1',
        format: 'scrapbox',
        projectName: 'custom-project',
      });

      expect(mockedCosense.getPage).toHaveBeenCalledWith('custom-project', 'Test Page', mockCosenseSid);
      expect(mockedPatch).toHaveBeenCalledWith(
        'custom-project',
        'Test Page',
        expect.any(Function),
        { sid: mockCosenseSid }
      );
    });

    test('compactモードでは短いメッセージを返すこと', async () => {
      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new 1',
        format: 'scrapbox',
        compact: true,
      });

      expect(result.content?.[0]?.text).toBe('rewrote: Test Page (3 -> 2 lines)');
    });
  });

  describe('エラー処理', () => {
    test('patchがResult.Errを返した場合にエラーレスポンスを返すこと', async () => {
      mockedPatch.mockResolvedValue({
        ok: false,
        val: null,
        err: { name: 'ConflictError', message: 'conflict' }
      } as unknown as Awaited<ReturnType<typeof mockedPatch>>);

      const result = await handleRewritePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        body: 'new 1',
        format: 'scrapbox',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('WebSocket patch failed');
    });
  });
});
