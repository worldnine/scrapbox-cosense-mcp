import { getPage, listPages, searchPages, createPageUrl, toReadablePage } from '@/cosense.js';
import { fetch } from '@whatwg-node/fetch';

// fetchをモック
jest.mock('@whatwg-node/fetch');
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

// sortPagesモジュールをモック
jest.mock('@/utils/sort.js', () => ({
  sortPages: jest.fn((pages) => pages), // 単純にそのまま返すモック
}));

describe('cosense API functions', () => {
  const mockProjectName = 'test-project';
  const mockSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPage', () => {
    const mockPageResponse = {
      id: 'page1',
      title: 'Test Page',
      lines: [
        { id: 'line1', text: 'Line 1', userId: 'user1', created: 1700000000, updated: 1700000000 },
        { id: 'line2', text: 'Line 2', userId: 'user1', created: 1700000001, updated: 1700000001 },
      ],
      created: 1700000000,
      updated: 1700001000,
      links: ['Related Page'],
      relatedPages: { links1hop: [] },
      user: {
        id: 'user1',
        name: 'testuser',
        displayName: 'Test User',
        photo: 'photo.jpg',
      },
      collaborators: [],
    };

    test('正常にページを取得できること', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPageResponse),
      } as Response);

      const result = await getPage(mockProjectName, 'Test Page', mockSid);

      expect(result).toEqual(mockPageResponse);
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/pages/${mockProjectName}/Test%20Page`),
        expect.objectContaining({
          headers: { Cookie: `connect.sid=${mockSid}` },
        })
      );
    });

    test('SIDなしでもページを取得できること', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPageResponse),
      } as Response);

      const result = await getPage(mockProjectName, 'Test Page');

      expect(result).toEqual(mockPageResponse);
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/pages/${mockProjectName}/Test%20Page`),
      );
    });

    test('APIエラーの場合にnullを返すこと', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await getPage(mockProjectName, 'Nonexistent Page', mockSid);

      expect(result).toBeNull();
    });

    test('不正なレスポンス形式の場合にnullを返すこと', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve('invalid response'),
      } as Response);

      const result = await getPage(mockProjectName, 'Test Page', mockSid);

      expect(result).toBeNull();
    });

    test('ネットワークエラーの場合にnullを返すこと', async () => {
      mockedFetch.mockRejectedValue(new Error('Network error'));

      const result = await getPage(mockProjectName, 'Test Page', mockSid);

      expect(result).toBeNull();
    });
  });

  describe('listPages', () => {
    const mockListResponse = {
      limit: 10,
      count: 2,
      skip: 0,
      projectName: mockProjectName,
      pages: [
        {
          title: 'Page 1',
          created: 1700000000,
          updated: 1700001000,
        },
        {
          title: 'Page 2',
          created: 1700002000,
          updated: 1700003000,
        },
      ],
    };

    test('正常にページリストを取得できること', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockListResponse),
      } as Response);

      // getPageのモック（詳細情報取得用）
      mockedFetch.mockImplementation((url) => {
        if (url.toString().includes('/api/pages/')) {
          if (url.toString().includes('Page%201')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                ...mockListResponse.pages[0],
                lines: [{ id: 'line1', text: 'Content 1' }],
                user: { id: 'user1', displayName: 'User 1' },
                collaborators: [],
              }),
            } as Response);
          }
          if (url.toString().includes('Page%202')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                ...mockListResponse.pages[1],
                lines: [{ id: 'line2', text: 'Content 2' }],
                user: { id: 'user2', displayName: 'User 2' },
                collaborators: [],
              }),
            } as Response);
          }
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockListResponse),
        } as Response);
      });

      const result = await listPages(mockProjectName, mockSid, {
        limit: 10,
        skip: 0,
        sort: 'updated',
      });

      expect(result.pages).toHaveLength(2);
      expect(result.projectName).toBe(mockProjectName);
      expect(mockedFetch).toHaveBeenCalled();
    });

    test('デフォルトパラメータが正しく適用されること', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockListResponse),
      } as Response);

      await listPages(mockProjectName, mockSid);

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=1000'),
        expect.any(Object)
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('skip=0'),
        expect.any(Object)
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=created'),
        expect.any(Object)
      );
    });

    test('APIエラーの場合にエラー情報を含むレスポンスを返すこと', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await listPages(mockProjectName, mockSid);

      expect(result.pages).toEqual([]);
      expect(result.debug?.error).toContain('API error: 500 Internal Server Error');
    });
  });

  describe('searchPages', () => {
    const mockSearchResponse = {
      projectName: mockProjectName,
      searchQuery: 'test',
      query: { words: ['test'], excludes: [] },
      limit: 100,
      count: 1,
      existsExactTitleMatch: false,
      backend: 'elasticsearch' as const,
      pages: [
        {
          id: 'page1',
          title: 'Test Page',
          image: '',
          words: ['test'],
          lines: ['This is a test page'],
        },
      ],
    };

    test('正常に検索できること', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      } as Response);

      const result = await searchPages(mockProjectName, 'test', mockSid);

      expect(result?.pages).toHaveLength(1);
      expect(result?.searchQuery).toBe('test');
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/query?q=test'),
        expect.objectContaining({
          headers: { Cookie: `connect.sid=${mockSid}` },
        })
      );
    });

    test('検索クエリがエンコードされること', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      } as Response);

      await searchPages(mockProjectName, 'test query', mockSid);

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=test%20query'),
        expect.any(Object)
      );
    });

    test('APIエラーの場合にエラー情報を含むレスポンスを返すこと', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const result = await searchPages(mockProjectName, 'test', mockSid);

      expect(result?.pages).toEqual([]);
      expect(result?.debug?.error).toContain('Search API error: 400 Bad Request');
    });
  });

  describe('createPageUrl', () => {
    test('基本的なURLを生成できること', () => {
      const url = createPageUrl(mockProjectName, 'Test Page');
      expect(url).toBe(`https://scrapbox.io/${mockProjectName}/Test%20Page`);
    });

    test('本文ありのURLを生成できること', () => {
      const url = createPageUrl(mockProjectName, 'Test Page', 'Page content');
      expect(url).toBe(`https://scrapbox.io/${mockProjectName}/Test%20Page?body=Page%20content`);
    });

    test('特殊文字を含むタイトルが正しくエンコードされること', () => {
      const url = createPageUrl(mockProjectName, 'Test & Page');
      expect(url).toBe(`https://scrapbox.io/${mockProjectName}/Test%20%26%20Page`);
    });
  });

  describe('toReadablePage', () => {
    const mockGetPageResponse = {
      id: 'page1',
      title: 'Test Page',
      lines: [
        { id: 'line1', text: 'Line 1', userId: 'user1', created: 1700000000, updated: 1700000000 },
      ],
      created: 1700000000,
      updated: 1700001000,
      links: ['Related Page'],
      relatedPages: { links1hop: [] },
      user: {
        id: 'user1',
        name: 'testuser',
        displayName: 'Test User',
        photo: 'photo.jpg',
      },
      lastUpdateUser: {
        id: 'user2',
        name: 'updateuser',
        displayName: 'Update User',
        photo: 'photo2.jpg',
      },
      collaborators: [],
    };

    test('GetPageResponseを正しく変換できること', () => {
      const result = toReadablePage(mockGetPageResponse);

      expect(result.title).toBe('Test Page');
      expect(result.lines).toEqual(mockGetPageResponse.lines);
      expect(result.created).toBe(1700000000);
      expect(result.updated).toBe(1700001000);
      expect(result.user).toEqual(mockGetPageResponse.user);
      expect(result.lastUpdateUser).toEqual(mockGetPageResponse.lastUpdateUser);
      expect(result.collaborators).toEqual(mockGetPageResponse.collaborators);
      expect(result.links).toEqual(mockGetPageResponse.links);
    });

    test('lastUpdateUserがundefinedの場合も正しく処理されること', () => {
      const responseWithoutLastUpdate = {
        ...mockGetPageResponse,
        lastUpdateUser: undefined,
      };

      const result = toReadablePage(responseWithoutLastUpdate);

      expect(result.lastUpdateUser).toBeUndefined();
    });
  });
});