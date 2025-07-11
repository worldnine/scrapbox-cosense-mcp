import { handleCreatePage } from '@/routes/handlers/create-page.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
jest.mock('@/utils/markdown-converter.js', () => ({
  convertMarkdownToScrapbox: jest.fn((text) => text) // そのまま返す
}));
// @cosense/stdライブラリ全体をモック
jest.mock('@cosense/std/websocket', () => ({
  push: jest.fn()
}));

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

// pushのモックを動的に取得
let mockedPush: jest.MockedFunction<typeof import('@cosense/std/websocket').push>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPush = websocketModule.push as jest.MockedFunction<typeof import('@cosense/std/websocket').push>;
});

describe('handleCreatePage', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // createPageUrlのデフォルトモック
    mockedCosense.createPageUrl.mockReturnValue(
      'https://scrapbox.io/test-project/New%20Page'
    );
  });

  describe('正常ケース', () => {
    test('タイトルのみでページを作成できること（WebSocket API）', async () => {
      mockedPush.mockResolvedValue(undefined);
      const params = { title: 'New Page' };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('Successfully created page');
      expect(result.content[0]?.text).toContain('Title: New Page');
      expect(result.content[0]?.text).toContain('Lines: 1');

      expect(mockedPush).toHaveBeenCalledWith(
        mockProjectName,
        'New Page',
        expect.any(Function),
        { sid: mockCosenseSid }
      );
    });

    test('createActually=falseでURL生成のみ行うこと', async () => {
      const params = { title: 'New Page', createActually: false };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('Created page: New Page');
      expect(result.content[0]?.text).toContain('URL: https://scrapbox.io/test-project/New%20Page');

      expect(mockedPush).not.toHaveBeenCalled();
      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        'New Page',
        undefined
      );
    });

    test('本文付きでページを作成できること（WebSocket API）', async () => {
      mockedPush.mockResolvedValue(undefined);
      const params = { 
        title: 'New Page',
        body: '# Header\nContent'
      };
      
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content[0]?.text).toContain('Successfully created page');
      expect(result.content[0]?.text).toContain('Lines: 3'); // title + 2 lines
      expect(mockedPush).toHaveBeenCalled();
    });
  });

  describe('エラーケース', () => {
    test('COSENSE_SID無しでcreateActually=trueの場合にエラーを返すこと', async () => {
      const params = { title: 'New Page', createActually: true };
      const result = await handleCreatePage(mockProjectName, undefined, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error: Authentication required');
      expect(result.content[0]?.text).toContain('COSENSE_SID environment variable is required');
      expect(mockedPush).not.toHaveBeenCalled();
    });

    test('WebSocket APIでエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'WebSocket error';
      mockedPush.mockRejectedValue(new Error(errorMessage));

      const params = { title: 'New Page' };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error details:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });

    test('createPageUrlでエラーが発生した場合にエラーレスポンスを返すこと（createActually=false）', async () => {
      const errorMessage = 'URL creation failed';
      mockedCosense.createPageUrl.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const params = { title: 'New Page', createActually: false };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error details:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });

  describe('出力フォーマット', () => {
    test('WebSocket API成功レスポンスのフォーマットが正しいこと', async () => {
      mockedPush.mockResolvedValue(undefined);
      const params = { title: 'New Page' };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      
      const outputText = result.content[0]?.text || '';
      expect(outputText).toContain('Successfully created page');
      expect(outputText).toContain('Operation: create_page');
      expect(outputText).toContain('Project: test-project');
      expect(outputText).toContain('Title: New Page');
      expect(outputText).toContain('Lines: 1');
      expect(outputText).toContain('URL: https://scrapbox.io/test-project/New%20Page');
      expect(outputText).toContain('Timestamp:');
    });

    test('URL生成のみのレスポンスフォーマットが正しいこと', async () => {
      const params = { title: 'New Page', createActually: false };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      
      const outputLines = result.content[0]?.text.split('\n') || [];
      expect(outputLines).toEqual([
        'Created page: New Page',
        'URL: https://scrapbox.io/test-project/New%20Page'
      ]);
    });
  });
});