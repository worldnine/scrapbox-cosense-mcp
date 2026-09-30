import { getPage, listPages, searchPages, createPageUrl, toReadablePage, withUserNames, clearMembersCache, getSmartContext } from '@/cosense.js';
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
        expect.stringContaining(`/api/pages/v2/${mockProjectName}/Test%20Page`),
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
        expect.stringContaining(`/api/pages/v2/${mockProjectName}/Test%20Page`),
      );
    });

    test('SIDが無ければCOSENSE_MCP_PATのヘッダを付けること', async () => {
      process.env.COSENSE_MCP_PAT = 'test-pat';
      try {
        mockedFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockPageResponse),
        } as Response);

        await getPage(mockProjectName, 'Test Page');

        expect(mockedFetch).toHaveBeenCalledWith(
          expect.stringContaining('Test%20Page'),
          { headers: { 'x-personal-access-token': 'test-pat' } },
        );
      } finally {
        delete process.env.COSENSE_MCP_PAT;
      }
    });

    test('SIDとCOSENSE_MCP_PATの両方があればSIDのcookieを付けること', async () => {
      process.env.COSENSE_MCP_PAT = 'test-pat';
      try {
        mockedFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockPageResponse),
        } as Response);

        await getPage(mockProjectName, 'Test Page', mockSid);

        expect(mockedFetch).toHaveBeenCalledWith(
          expect.stringContaining('Test%20Page'),
          { headers: { Cookie: `connect.sid=${mockSid}` } },
        );
      } finally {
        delete process.env.COSENSE_MCP_PAT;
      }
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
          descriptions: ['Content 1'],
        },
        {
          title: 'Page 2',
          created: 1700002000,
          updated: 1700003000,
          descriptions: ['Content 2'],
        },
      ],
    };

    test('一覧のAPIを1回だけ呼び、ページごとの詳細は取り直さないこと', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockListResponse),
      } as Response);

      const result = await listPages(mockProjectName, mockSid, {
        limit: 10,
        skip: 0,
        sort: 'updated',
      });

      expect(result.pages).toHaveLength(2);
      expect(result.projectName).toBe(mockProjectName);
      // 冒頭の行は一覧の API が返すものをそのまま使う
      expect(result.pages[0]?.descriptions).toEqual(['Content 1']);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/pages/${mockProjectName}?`),
        expect.any(Object)
      );
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
        expect.stringContaining('sort=updated'),
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

  describe('withUserNames', () => {
    const members = {
      projectId: 'project1',
      users: [
        { id: 'u1', name: 'alice', displayName: 'Alice', photo: 'a.png', email: 'alice@example.com' },
        { id: 'u2', name: 'bob', displayName: 'Bob', photo: 'b.png', email: 'bob@example.com' },
        { id: 'u3', name: 'carol', displayName: 'Carol', photo: 'c.png', email: 'carol@example.com' },
      ],
    };
    const pages = [
      { title: 'Page 1', user: { id: 'u1' }, lastUpdateUser: { id: 'u2' }, users: [{ id: 'u1' }, { id: 'u3' }, { id: 'unknown' }] },
      { title: 'Page 2', user: { id: 'u2' }, lastUpdateUser: { id: 'u2' }, users: [{ id: 'u2' }] },
    ] as unknown as Parameters<typeof withUserNames>[1];

    beforeEach(() => {
      clearMembersCache();
    });

    test('メンバー一覧を1回だけ引き、作成者・最終編集者・他の編集者に名前を付けること', async () => {
      mockedFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(members) } as Response);

      const result = await withUserNames(mockProjectName, pages, mockSid);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch).toHaveBeenCalledWith(
        `https://scrapbox.io/api/projects/${mockProjectName}/users`,
        { headers: { Cookie: `connect.sid=${mockSid}` } },
      );
      expect(result[0]?.user?.displayName).toBe('Alice');
      expect(result[0]?.lastUpdateUser?.displayName).toBe('Bob');
      // メンバー一覧に無い ID は落とす
      expect(result[0]?.collaborators?.map(c => c.displayName)).toEqual(['Alice', 'Carol']);
      expect(result[1]?.user?.displayName).toBe('Bob');
      // メールアドレスは持ち込まない
      expect(JSON.stringify(result)).not.toContain('@example.com');
    });

    test('メンバー一覧が引けなければ、ページをそのまま返すこと', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 403 } as Response);

      const result = await withUserNames(mockProjectName, pages, mockSid);

      expect(result).toBe(pages);
    });

    test('メンバー一覧は覚えておき、2回目からは問い合わせないこと', async () => {
      mockedFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(members) } as Response);

      await withUserNames(mockProjectName, pages, mockSid);
      const second = await withUserNames(mockProjectName, pages, mockSid);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(second[0]?.user?.displayName).toBe('Alice');
    });

    test('同時に呼ばれても、問い合わせは1回だけで、どちらにも名前が付くこと', async () => {
      mockedFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(members) } as Response);

      const [a, b] = await Promise.all([
        withUserNames(mockProjectName, pages, mockSid),
        withUserNames(mockProjectName, pages, mockSid),
      ]);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(a[0]?.user?.displayName).toBe('Alice');
      expect(b[0]?.user?.displayName).toBe('Alice');
    });

    test('引けなかった結果も覚えておき、無駄に問い合わせ直さないこと', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 403 } as Response);

      await withUserNames(mockProjectName, pages, mockSid);
      await withUserNames(mockProjectName, pages, mockSid);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    test('数分たてば問い合わせ直すこと', async () => {
      const now = jest.spyOn(Date, 'now');
      try {
        now.mockReturnValue(1_000_000);
        mockedFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(members) } as Response);
        await withUserNames(mockProjectName, pages, mockSid);

        now.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1);
        await withUserNames(mockProjectName, pages, mockSid);

        expect(mockedFetch).toHaveBeenCalledTimes(2);
      } finally {
        now.mockRestore();
      }
    });

    test('ページが無ければ問い合わせないこと', async () => {
      const result = await withUserNames(mockProjectName, [], mockSid);

      expect(result).toEqual([]);
      expect(mockedFetch).not.toHaveBeenCalled();
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

  describe('getSmartContext', () => {
    afterEach(() => {
      delete process.env.COSENSE_MCP_PAT;
    });

    test('SIDのcookieを付けて取得すること', async () => {
      mockedFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('context') } as Response);

      const result = await getSmartContext(mockProjectName, 'Test Page', 1, mockSid);

      expect(result).toEqual({ ok: true, text: 'context' });
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/smart-context/export-1hop-links/${mockProjectName}.txt?title=Test%20Page`),
        { headers: { Cookie: `connect.sid=${mockSid}` } },
      );
    });

    test('SIDが無くてもCOSENSE_MCP_PATで取得すること', async () => {
      process.env.COSENSE_MCP_PAT = 'test-pat';
      mockedFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('context') } as Response);

      const result = await getSmartContext(mockProjectName, 'Test Page', 2);

      expect(result).toEqual({ ok: true, text: 'context' });
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/smart-context/export-2hop-links/${mockProjectName}.txt`),
        { headers: { 'x-personal-access-token': 'test-pat' } },
      );
    });
  });
});
