import { handleCreatePage } from '@/routes/handlers/create-page.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
jest.mock('@/utils/markdown-converter.js');
jest.mock('child_process');

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

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
    test('タイトルのみでページを作成できること', async () => {
      const params = { title: 'New Page' };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('Opening new page: New Page');
      expect(result.content[0]?.text).toContain('URL: https://scrapbox.io/test-project/New%20Page');

      expect(mockedCosense.createPageUrl).toHaveBeenCalledWith(
        mockProjectName,
        'New Page',
        undefined
      );
    });

    test('基本的な動作確認', async () => {
      const params = { 
        title: 'New Page',
        body: '# Header\nContent'
      };
      
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content[0]?.text).toContain('Opening new page: New Page');
      expect(mockedCosense.createPageUrl).toHaveBeenCalled();
    });
  });

  describe('エラーケース', () => {
    test('createPageUrlでエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'URL creation failed';
      mockedCosense.createPageUrl.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const params = { title: 'New Page' };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error details:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });

  describe('出力フォーマット', () => {
    test('成功レスポンスのフォーマットが正しいこと', async () => {
      const params = { title: 'New Page' };
      const result = await handleCreatePage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      
      const outputLines = result.content[0]?.text.split('\n') || [];
      expect(outputLines).toEqual([
        'Opening new page: New Page',
        'URL: https://scrapbox.io/test-project/New%20Page'
      ]);
    });
  });
});