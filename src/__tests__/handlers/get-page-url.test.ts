import { handleGetPageUrl } from '@/routes/handlers/get-page-url.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('handleGetPageUrl', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // createPageUrlのデフォルトモック
    mockedCosense.createPageUrl.mockImplementation(
      (projectName: string, title: string) => 
        `https://scrapbox.io/${projectName}/${encodeURIComponent(title)}`
    );
  });

  describe('正常ケース', () => {
    test('基本的なタイトルでURLを生成できること', async () => {
      const params = { title: 'New Page' };
      const result = await handleGetPageUrl(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toBe('https://scrapbox.io/test-project/New%20Page');

      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        'New Page'
      );
    });

    test('日本語タイトルでURLを生成できること', async () => {
      const params = { title: 'テストページ' };
      const result = await handleGetPageUrl(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toBe('https://scrapbox.io/test-project/%E3%83%86%E3%82%B9%E3%83%88%E3%83%9A%E3%83%BC%E3%82%B8');

      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        'テストページ'
      );
    });

    test('特殊文字を含むタイトルでURLを生成できること', async () => {
      const params = { title: 'Page with @#$%' };
      const result = await handleGetPageUrl(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toBe('https://scrapbox.io/test-project/Page%20with%20%40%23%24%25');

      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        'Page with @#$%'
      );
    });
  });

  describe('エラーケース', () => {
    test('createPageUrlでエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'URL generation failed';
      mockedCosense.createPageUrl.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const params = { title: 'New Page' };
      const result = await handleGetPageUrl(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error details:');
      expect(result.content[0]?.text).toContain(errorMessage);
      expect(result.content[0]?.text).toContain('Operation: get_page_url');
      expect(result.content[0]?.text).toContain('Project: test-project');
      expect(result.content[0]?.text).toContain('Title: New Page');
    });
  });

  describe('パラメータ処理', () => {
    test('titleパラメータを文字列として正しく処理すること', async () => {
      const params = { title: 123 as any }; // 数値を渡してもStringで変換される
      const result = await handleGetPageUrl(mockProjectName, mockCosenseSid, params);

      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        '123'
      );
    });
  });
});