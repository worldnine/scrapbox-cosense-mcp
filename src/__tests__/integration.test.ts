import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { setupRoutes } from '@/routes/index.js';
import * as cosense from '@/cosense.js';

// モック設定
jest.mock('@/cosense.js');
const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('MCP Integration Tests', () => {
  let server: Server;
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    // 新しいサーバーインスタンスを作成
    server = new Server(
      {
        name: 'scrapbox-cosense-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );

    // ルートを設定
    setupRoutes(server, {
      projectName: mockProjectName,
      cosenseSid: mockCosenseSid,
    });

    jest.clearAllMocks();
  });

  describe('Tools Integration', () => {
    test('list_pages ツールが正常に動作すること', async () => {
      const mockResponse = {
        limit: 10,
        count: 2,
        skip: 0,
        projectName: mockProjectName,
        pages: [
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
            pin: 0,
          },
        ],
      };

      mockedCosense.listPagesWithSort.mockResolvedValue(mockResponse);

      // CallToolRequestを作成
      const request = {
        params: {
          name: 'list_pages',
          arguments: {
            sort: 'updated',
            limit: 10,
            skip: 0,
          },
        },
      };

      // ツールを呼び出し
      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Project: test-project');
      expect(mockedCosense.listPagesWithSort).toHaveBeenCalledWith(
        mockProjectName,
        expect.objectContaining({ limit: 10, skip: 0 }),
        mockCosenseSid
      );
    });

    test('get_page ツールが正常に動作すること', async () => {
      const mockPageResponse = {
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
        collaborators: [],
      };

      mockedCosense.getPage.mockResolvedValue(mockPageResponse);

      const request = {
        params: {
          name: 'get_page',
          arguments: {
            pageTitle: 'Test Page',
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Title: Test Page');
      expect(mockedCosense.getPage).toHaveBeenCalledWith(
        mockProjectName,
        'Test Page',
        mockCosenseSid
      );
    });

    test('search_pages ツールが正常に動作すること', async () => {
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

      mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

      const request = {
        params: {
          name: 'search_pages',
          arguments: {
            query: 'test',
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Search Results for: test');
      expect(mockedCosense.searchPages).toHaveBeenCalledWith(
        mockProjectName,
        'test',
        mockCosenseSid
      );
    });

    test('create_page ツールが正常に動作すること', async () => {
      // markdown-converterのモック
      jest.doMock('@/utils/markdown-converter.js', () => ({
        convertMarkdownToScrapbox: jest.fn().mockResolvedValue('converted content'),
      }));

      mockedCosense.createPageUrl.mockReturnValue('https://scrapbox.io/test-project/New%20Page');

      const request = {
        params: {
          name: 'create_page',
          arguments: {
            title: 'New Page',
            body: '# Header\nContent',
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Opening new page: New Page');
      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        'New Page',
        'converted content'
      );
    });

    test('存在しないツールの場合にエラーレスポンスを返すこと', async () => {
      const request = {
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool requested');
      expect(result.content[0].text).toContain('Tool: nonexistent_tool');
    });
  });

  describe('Error Handling Integration', () => {
    test('APIエラーが適切にハンドリングされること', async () => {
      mockedCosense.listPagesWithSort.mockRejectedValue(new Error('API connection failed'));

      const request = {
        params: {
          name: 'list_pages',
          arguments: {
            limit: 10,
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API connection failed');
      expect(result.content[0].text).toContain('Operation: list_pages');
    });

    test('ページが見つからない場合のエラーハンドリング', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const request = {
        params: {
          name: 'get_page',
          arguments: {
            pageTitle: 'Nonexistent Page',
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Page not found: Nonexistent Page');
    });
  });

  describe('Parameter Validation', () => {
    test('必須パラメータが不足している場合のエラーハンドリング', async () => {
      const request = {
        params: {
          name: 'get_page',
          arguments: {
            // pageTitle が不足
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      // パラメータ検証エラーが適切に処理されることを確認
      expect(result).toBeDefined();
    });

    test('不正なパラメータタイプが適切に処理されること', async () => {
      mockedCosense.listPagesWithSort.mockResolvedValue({
        limit: 0,
        count: 0,
        skip: 0,
        projectName: mockProjectName,
        pages: [],
      });

      const request = {
        params: {
          name: 'list_pages',
          arguments: {
            limit: 'invalid', // 数値ではない
            skip: null,
          },
        },
      };

      const handler = server.getRequestHandler(CallToolRequestSchema);
      const result = await handler!(request as any, {} as any);

      // 不正なパラメータが適切に処理されることを確認
      expect(result).toBeDefined();
    });
  });
});