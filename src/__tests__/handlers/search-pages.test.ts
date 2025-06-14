import { handleSearchPages } from '@/routes/handlers/search-pages.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('handleSearchPages', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  const mockSearchResponse = {
    projectName: mockProjectName,
    searchQuery: 'test query',
    query: { words: ['test', 'query'], excludes: [] },
    limit: 100,
    count: 2,
    existsExactTitleMatch: false,
    backend: 'elasticsearch' as const,
    pages: [
      {
        id: 'page1',
        title: 'Test Page 1',
        image: '',
        words: ['test', 'example'],
        lines: ['This is a test page', 'With some content'],
        created: 1700000000,
        updated: 1700001000,
        user: {
          id: 'user1',
          name: 'testuser',
          displayName: 'Test User',
          photo: 'photo.jpg',
        },
      },
      {
        id: 'page2',
        title: 'Another Test Page',
        image: '',
        words: ['query', 'search'],
        lines: ['Another test example', 'More content here'],
        created: 1700002000,
        updated: 1700003000,
        user: {
          id: 'user2',
          name: 'anotheruser',
          displayName: 'Another User',
          photo: 'photo2.jpg',
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常ケース', () => {
    test('検索結果が正常に返されること', async () => {
      mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

      const params = { query: 'test query' };
      const result = await handleSearchPages(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('Search query: test query');
      expect(result.content[0]?.text).toContain('Total results: 2');
      expect(result.content[0]?.text).toContain('Project: test-project');
      expect(result.content[0]?.text).toContain('Test Page 1');
      expect(result.content[0]?.text).toContain('Another Test Page');

      expect(mockedCosense.searchPages).toHaveBeenCalledWith(
        mockProjectName,
        'test query',
        mockCosenseSid
      );
    });

    test('基本的な動作確認', async () => {
      mockedCosense.searchPages.mockResolvedValue({
        ...mockSearchResponse,
        searchQuery: 'basic test',
        count: 1,
        pages: [mockSearchResponse.pages[0]!]
      });

      const params = { query: 'basic test' };
      const result = await handleSearchPages(mockProjectName, mockCosenseSid, params);

      expect(result.content[0]?.text).toContain('Search query: basic test');
      expect(result.content[0]?.text).toContain('Total results: 1');
    });
  });

  describe('エラーケース', () => {
    test('検索でエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'Search failed';
      mockedCosense.searchPages.mockRejectedValue(new Error(errorMessage));

      const params = { query: 'test query' };
      const result = await handleSearchPages(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error details:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });
});