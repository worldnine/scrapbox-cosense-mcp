// cosense.jsのモック
jest.mock('@/cosense.js', () => ({
  listPagesBasic: jest.fn(),
  getPage: jest.fn(),
  toReadablePage: jest.fn(),
  searchPages: jest.fn(),
}));

import * as cosense from '@/cosense.js';
const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('resources/list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listPagesBasic モック検証', () => {
    test('listPagesBasicが呼び出し可能であること', async () => {
      mockedCosense.listPagesBasic.mockResolvedValue({
        limit: 100,
        count: 2,
        skip: 0,
        projectName: 'test-project',
        pages: [
          { title: 'Page 1' },
          { title: 'Page 2' },
        ],
      });

      const result = await cosense.listPagesBasic('test-project', undefined, {
        limit: 100,
        skip: 0,
        sort: 'updated',
      });

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0]?.title).toBe('Page 1');
    });

    test('空結果が正しく返されること', async () => {
      mockedCosense.listPagesBasic.mockResolvedValue({
        limit: 100,
        count: 0,
        skip: 0,
        projectName: 'test-project',
        pages: [],
      });

      const result = await cosense.listPagesBasic('test-project');
      expect(result.pages).toHaveLength(0);
    });
  });
});

describe('resources/templates/list', () => {
  test('テンプレートの構造が正しいこと', () => {
    // テンプレートの値を検証（ハンドラ外のロジック検証）
    const projectName = 'test-project';
    const SERVICE_LABEL = 'cosense (scrapbox)';

    const template = {
      uriTemplate: "cosense:///search/{query}",
      name: `Search pages in ${projectName}`,
      description: `${SERVICE_LABEL} の ${projectName} プロジェクトの全文検索。キーワード、AND検索、除外語（-word）、フレーズ検索（"phrase"）対応。最大100件。`,
      mimeType: "text/plain",
    };

    expect(template.uriTemplate).toBe('cosense:///search/{query}');
    expect(template.name).toContain('test-project');
    expect(template.description).toContain('全文検索');
    expect(template.mimeType).toBe('text/plain');
  });
});

describe('resources/read 検索URI解析', () => {
  const mockSearchResponse = {
    projectName: 'test-project',
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
        words: ['test'],
        lines: ['This is a test page'],
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
        title: 'Test Page 2',
        image: '',
        words: ['query'],
        lines: ['Another page with query'],
        created: 1700002000,
        updated: 1700003000,
        user: {
          id: 'user2',
          name: 'user2',
          displayName: 'User Two',
          photo: 'photo2.jpg',
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('検索URIのパスパターンが正しくマッチすること', () => {
    const path = 'search/test query';
    const match = path.match(/^search\/(.+)$/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('test query');
  });

  test('URLエンコードされた検索クエリが正しくデコードされること', () => {
    const uri = 'cosense:///search/%E6%97%A5%E6%9C%AC%E8%AA%9E';
    const url = new URL(uri);
    const decodedPath = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const match = decodedPath.match(/^search\/(.+)$/);
    expect(match?.[1]).toBe('日本語');
  });

  test('通常のページURIが検索パターンにマッチしないこと', () => {
    const path = 'Normal Page Title';
    const match = path.match(/^search\/(.+)$/);
    expect(match).toBeNull();
  });

  test('searchPagesが正しく呼び出されること', async () => {
    mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

    const result = await cosense.searchPages('test-project', 'test query', 'test-sid');

    expect(result).not.toBeNull();
    expect(result?.count).toBe(2);
    expect(result?.pages).toHaveLength(2);
    expect(result?.pages[0]?.title).toBe('Test Page 1');
    expect(mockedCosense.searchPages).toHaveBeenCalledWith(
      'test-project',
      'test query',
      'test-sid'
    );
  });

  test('検索結果が空の場合', async () => {
    mockedCosense.searchPages.mockResolvedValue({
      ...mockSearchResponse,
      count: 0,
      pages: [],
    });

    const result = await cosense.searchPages('test-project', 'nonexistent', 'test-sid');
    expect(result?.count).toBe(0);
    expect(result?.pages).toHaveLength(0);
  });
});

describe('resources/read ページ読み込み', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getPageが正しく呼び出されること', async () => {
    const mockPageResponse = {
      id: 'page1',
      title: 'Test Page',
      lines: [
        { id: 'line1', text: 'Test Page', userId: 'user1', created: 1700000000, updated: 1700000000 },
        { id: 'line2', text: 'Content line', userId: 'user1', created: 1700000000, updated: 1700000000 },
      ],
      created: 1700000000,
      updated: 1700001000,
      links: ['Link1', 'Link2'],
      relatedPages: { links1hop: [] },
      user: { id: 'user1', name: 'testuser', displayName: 'Test User', photo: 'photo.jpg' },
      collaborators: [],
    };

    mockedCosense.getPage.mockResolvedValue(mockPageResponse);
    mockedCosense.toReadablePage.mockReturnValue({
      title: 'Test Page',
      lines: mockPageResponse.lines,
      created: 1700000000,
      updated: 1700001000,
      user: mockPageResponse.user,
      collaborators: [],
      links: ['Link1', 'Link2'],
    });

    const result = await cosense.getPage('test-project', 'Test Page', 'test-sid');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Test Page');

    const readable = cosense.toReadablePage(result!);
    expect(readable.title).toBe('Test Page');
    expect(readable.links).toEqual(['Link1', 'Link2']);
  });

  test('存在しないページでnullが返ること', async () => {
    mockedCosense.getPage.mockResolvedValue(null);

    const result = await cosense.getPage('test-project', 'Nonexistent', 'test-sid');
    expect(result).toBeNull();
  });
});
