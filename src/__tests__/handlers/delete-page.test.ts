import { handleDeletePage, isDeleteEnabled } from '@/routes/handlers/delete-page.js';
import * as cosense from '@/cosense.js';

jest.mock('@/cosense.js');
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

// getPageの戻り値を組み立てる。存在するページはpersistentがtrueになる
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

describe('handleDeletePage', () => {
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

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('COSENSE_ENABLE_DELETE');
      expect(mockedPatch).not.toHaveBeenCalled();
    });

    test('COSENSE_ENABLE_DELETEがtrue以外の場合もエラーを返すこと', async () => {
      process.env.COSENSE_ENABLE_DELETE = '1';

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
      });

      expect(result.isError).toBe(true);
      expect(mockedPatch).not.toHaveBeenCalled();
    });

    test('isDeleteEnabledが環境変数の状態を反映すること', () => {
      process.env.COSENSE_ENABLE_DELETE = 'true';
      expect(isDeleteEnabled()).toBe(true);

      process.env.COSENSE_ENABLE_DELETE = 'false';
      expect(isDeleteEnabled()).toBe(false);

      delete process.env.COSENSE_ENABLE_DELETE;
      expect(isDeleteEnabled()).toBe(false);
    });
  });

  describe('認証', () => {
    test('COSENSE_SIDが未設定の場合に認証エラーを返すこと', async () => {
      const result = await handleDeletePage(mockProjectName, undefined, {
        pageTitle: 'Test Page',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Authentication required');
      expect(mockedPatch).not.toHaveBeenCalled();
    });
  });

  describe('存在チェック', () => {
    test('getPageがnullを返す場合はエラーになり、patchを呼ばないこと', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Missing Page',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Page not found');
      expect(mockedPatch).not.toHaveBeenCalled();
    });

    test('存在しないページはタイトル行だけを返すが、persistentがfalseなのでエラーになること', async () => {
      // 未作成のページに対してもAPIはタイトル行を含むレスポンスを返す。
      // 行数だけでは存在を判定できないため、persistentで判定する
      mockedCosense.getPage.mockResolvedValue(mockPage(['Missing Page'], false));

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Missing Page',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Page not found');
      expect(mockedPatch).not.toHaveBeenCalled();
    });
  });

  describe('ドライラン', () => {
    test('dryRunがtrueの場合はpatchを呼ばず、行数と冒頭の行を返すこと', async () => {
      mockedCosense.getPage.mockResolvedValue(
        mockPage(['Test Page', 'line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6'])
      );

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        dryRun: true,
      });

      expect(mockedPatch).not.toHaveBeenCalled();
      const text = result.content?.[0]?.text ?? '';
      expect(text).toContain('Dry run: no changes were made');
      expect(text).toContain('Lines to be removed: 7');
      expect(text).toContain('First 5 line(s):');
      expect(text).toContain('line 4');
      // 冒頭5行までなので6行目以降は含まれない
      expect(text).not.toContain('line 5');
    });

    test('ページの行数が5行未満の場合は存在する行だけを返すこと', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPage(['Test Page', 'only line']));

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        dryRun: true,
      });

      const text = result.content?.[0]?.text ?? '';
      expect(text).toContain('Lines to be removed: 2');
      expect(text).toContain('First 2 line(s):');
    });

    test('compactモードのドライランでは短いメッセージを返すこと', async () => {
      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        dryRun: true,
        compact: true,
      });

      expect(mockedPatch).not.toHaveBeenCalled();
      expect(result.content?.[0]?.text).toBe('dry-run: Test Page (3 lines) | Test Page / line 1 / line 2');
    });
  });

  describe('削除', () => {
    test('全ての行を空配列で置き換えること', async () => {
      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
      });

      expect(mockedPatch).toHaveBeenCalledWith(
        mockProjectName,
        'Test Page',
        expect.any(Function),
        { sid: mockCosenseSid }
      );

      const callback = mockedPatch.mock.calls[0]?.[2] as (lines: unknown[]) => unknown[];
      expect(callback([{ text: 'Test Page' }, { text: 'line 1' }])).toEqual([]);

      const text = result.content?.[0]?.text ?? '';
      expect(text).toContain('Successfully deleted page');
      expect(text).toContain('Removed lines: 3');
    });

    test('projectNameの指定が既定のプロジェクトより優先されること', async () => {
      await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
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
      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        compact: true,
      });

      expect(result.content?.[0]?.text).toBe('deleted: Test Page (3 lines)');
    });
  });

  describe('エラー処理', () => {
    test('patchがResult.Errを返した場合にエラーレスポンスを返すこと', async () => {
      mockedPatch.mockResolvedValue({
        ok: false,
        val: null,
        err: { name: 'NotFoundError', message: 'page not found' }
      } as unknown as Awaited<ReturnType<typeof mockedPatch>>);

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('WebSocket patch failed');
    });

    test('WebSocket APIで例外が発生した場合にエラーレスポンスを返すこと', async () => {
      mockedPatch.mockRejectedValue(new Error('socket exploded'));

      const result = await handleDeletePage(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('socket exploded');
    });
  });
});
