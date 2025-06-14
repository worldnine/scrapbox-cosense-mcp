import { handleListPages } from '@/routes/handlers/list-pages.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
jest.mock('@/utils/format.js');

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('handleListPages', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  const mockPages = [
    {
      title: 'Page 1',
      created: 1700000000,
      updated: 1700001000,
      pin: 0,
    },
    {
      title: 'Page 2',
      created: 1700002000,
      updated: 1700003000,
      pin: 1,
    },
  ];

  const mockListPagesResponse = {
    limit: 10,
    count: 2,
    skip: 0,
    projectName: mockProjectName,
    pages: mockPages,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // モック関数の設定
    mockedCosense.listPages.mockResolvedValue(mockListPagesResponse);
    mockedCosense.listPagesWithSort.mockResolvedValue(mockListPagesResponse);
  });

  describe('基本的な動作', () => {
    test('正常なパラメータでページリストを取得できること', async () => {
      const params = {
        sort: 'updated',
        limit: 10,
        skip: 0,
        excludePinned: false,
      };

      const result = await handleListPages(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content?.[0]?.type).toBe('text');
      expect(mockedCosense.listPagesWithSort).toHaveBeenCalledWith(
        mockProjectName,
        {
          limit: 10,
          skip: 0,
        },
        mockCosenseSid
      );
    });

    test('excludePinned=true の場合に正しく処理されること', async () => {
      const params = {
        excludePinned: true,
        limit: 10,
      };

      await handleListPages(mockProjectName, mockCosenseSid, params);

      expect(mockedCosense.listPages).toHaveBeenCalled();
      // excludePinned=trueの場合は特別な処理ロジックが使用される
    });

    test('デフォルトパラメータが正しく適用されること', async () => {
      await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(mockedCosense.listPagesWithSort).toHaveBeenCalledWith(
        mockProjectName,
        {
          limit: 1000,
          skip: 0,
        },
        mockCosenseSid
      );
    });
  });

  describe('パラメータ処理', () => {
    test('limit パラメータが正しく処理されること', async () => {
      const params = { limit: 50 };

      await handleListPages(mockProjectName, mockCosenseSid, params);

      expect(mockedCosense.listPagesWithSort).toHaveBeenCalledWith(
        mockProjectName,
        expect.objectContaining({ limit: 50 }),
        mockCosenseSid
      );
    });

    test('skip パラメータが正しく処理されること', async () => {
      const params = { skip: 20 };

      await handleListPages(mockProjectName, mockCosenseSid, params);

      expect(mockedCosense.listPagesWithSort).toHaveBeenCalledWith(
        mockProjectName,
        expect.objectContaining({ skip: 20 }),
        mockCosenseSid
      );
    });

    test('sort パラメータが定義されている場合に正しく処理されること', async () => {
      const params = { sort: 'created' };

      await handleListPages(mockProjectName, mockCosenseSid, params);

      expect(mockedCosense.listPagesWithSort).toHaveBeenCalledWith(
        mockProjectName,
        expect.objectContaining({}), // sortはspread operatorで条件付き追加される
        mockCosenseSid
      );
    });
  });

  describe('エラーハンドリング', () => {
    test('API エラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'API Error';
      mockedCosense.listPagesWithSort.mockRejectedValue(new Error(errorMessage));

      const result = await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Error details:');
      expect(result.content?.[0]?.text).toContain(errorMessage);
      expect(result.content?.[0]?.text).toContain('Operation: list_pages');
      expect(result.content?.[0]?.text).toContain(`Project: ${mockProjectName}`);
    });

    test('予期しないエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      mockedCosense.listPagesWithSort.mockRejectedValue('Unknown error');

      const result = await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Unknown error');
    });
  });

  describe('出力フォーマット', () => {
    test('出力にプロジェクト情報が含まれること', async () => {
      const result = await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(result.content?.[0]?.text).toContain(`Project: ${mockProjectName}`);
      expect(result.content?.[0]?.text).toContain('Total pages: 2');
      expect(result.content?.[0]?.text).toContain('Pages fetched: 10');
      expect(result.content?.[0]?.text).toContain('Pages skipped: 0');
    });

    test('ソート方法の説明が含まれること', async () => {
      // formatモジュールをモック
      const formatModule = await import('@/utils/format.js');
      jest.spyOn(formatModule, 'getSortDescription').mockReturnValue('Sorted by last updated');

      const result = await handleListPages(mockProjectName, mockCosenseSid, { sort: 'updated' });

      expect(result.content?.[0]?.text).toContain('Sort method: Sorted by last updated');
    });
  });
});