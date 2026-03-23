import { handleListPages } from '@/routes/handlers/list-pages.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
jest.mock('@/utils/format.js', () => ({
  formatPageListResult: jest.fn((response, sortDescription) => ({
    formatted: `Project: ${response.projectName}\nTotal pages: ${response.count}\nPages fetched: ${response.limit}\nPages skipped: ${response.skip}\nSort method: ${sortDescription}\n\nPages: ${response.pages.map((p: any) => p.title).join(', ')}`
  })),
  getSortDescription: jest.fn(() => 'Updated time (newest first)'),
  getSortValue: jest.fn(() => 'updated'),
  formatPageOutput: jest.fn(() => 'Mock formatted output'),
  formatPageCompact: jest.fn(() => '- Mock compact output'),
  formatError: jest.fn((message: string) => ({
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true
  }))
}));

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
          sort: 'updated',
        },
        mockCosenseSid
      );
    });

    test('基本的な動作確認', async () => {
      const result = await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(result.content).toHaveLength(1);
      expect(result.content?.[0]?.type).toBe('text');
      expect(mockedCosense.listPagesWithSort).toHaveBeenCalled();
    });
  });

  describe('excludePinned', () => {
    test('excludePinned時にPages fetchedが実際の返却件数を反映すること', async () => {
      const pagesWithPinned = [
        { title: 'Pinned Page', created: 1700000000, updated: 1700001000, pin: 1 },
        { title: 'Normal Page 1', created: 1700002000, updated: 1700003000, pin: 0 },
        { title: 'Normal Page 2', created: 1700004000, updated: 1700005000, pin: 0 },
      ];
      // デフォルトモックをリセットして excludePinned 用に設定
      mockedCosense.listPages.mockReset();
      // 1回目: ループ内でページ取得（3件返すが、pin=1が1件あるので未ピン留めは2件）
      mockedCosense.listPages.mockResolvedValueOnce({
        limit: 30,
        count: 3,
        skip: 0,
        projectName: mockProjectName,
        pages: pagesWithPinned,
      } as any);
      // 2回目: ループ終了（空配列）
      mockedCosense.listPages.mockResolvedValueOnce({
        limit: 30,
        count: 3,
        skip: 3,
        projectName: mockProjectName,
        pages: [],
      } as any);
      // 3回目: メタデータ取得（limit: 1）
      mockedCosense.listPages.mockResolvedValueOnce({
        limit: 1,
        count: 3,
        skip: 0,
        projectName: mockProjectName,
        pages: [pagesWithPinned[0]],
      } as any);

      const params = { excludePinned: true, limit: 10 };
      const result = await handleListPages(mockProjectName, mockCosenseSid, params);

      const text = result.content?.[0]?.text || '';
      // 未ピン留めページは2件なので、Pages fetchedも2であるべき
      expect(text).toContain('Pages fetched: 2');
    });
  });

  describe('エラーハンドリング', () => {
    test('API エラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'API Error';
      mockedCosense.listPagesWithSort.mockRejectedValue(new Error(errorMessage));

      const result = await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Error:');
      expect(result.content?.[0]?.text).toContain(errorMessage);
    });
  });
});