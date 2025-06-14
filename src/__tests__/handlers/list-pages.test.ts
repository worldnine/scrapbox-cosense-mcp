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
  formatPageOutput: jest.fn(() => 'Mock formatted output')
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

  describe('エラーハンドリング', () => {
    test('API エラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'API Error';
      mockedCosense.listPagesWithSort.mockRejectedValue(new Error(errorMessage));

      const result = await handleListPages(mockProjectName, mockCosenseSid, {});

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Error details:');
      expect(result.content?.[0]?.text).toContain(errorMessage);
    });
  });
});