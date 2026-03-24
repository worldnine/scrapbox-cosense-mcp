import { handleGetSmartContext } from '@/routes/handlers/get-smart-context.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('handleGetSmartContext', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  const mockSmartContextText = `This text contains the content of https://scrapbox.io/test-project/Test_Page and its related pages.
Total pages included: 2 (main page + 1 directly linked pages).

== GUIDE FOR AI AGENTS ==
1. START with the first page

<PageList>
<Page title="Test Page" url="https://scrapbox.io/test-project/Test_Page" updated="2024-01-01T00:00:00.000Z" created="2023-01-01T00:00:00.000Z" type="mainpage">
Test Page
#tag1 #tag2

コンテンツ本文
</Page>

<Page title="Related Page" url="https://scrapbox.io/test-project/Related_Page" updated="2024-01-01T00:00:00.000Z" created="2023-06-01T00:00:00.000Z" type="1hopLink">
Related Page

関連ページの内容
</Page>

</PageList>`;

  const mockOkResult = { ok: true as const, text: mockSmartContextText };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常ケース', () => {
    it('1ホップでスマートコンテキストを取得できる', async () => {
      mockedCosense.getSmartContext.mockResolvedValue(mockOkResult);

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
      });

      expect(mockedCosense.getSmartContext).toHaveBeenCalledWith(
        mockProjectName, 'Test Page', 1, mockCosenseSid
      );
      expect(result.content[0]?.text).toContain('Test Page');
      expect(result.content[0]?.text).toContain('<PageList>');
    });

    it('2ホップでスマートコンテキストを取得できる', async () => {
      mockedCosense.getSmartContext.mockResolvedValue(mockOkResult);

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
        hopCount: 2,
      });

      expect(mockedCosense.getSmartContext).toHaveBeenCalledWith(
        mockProjectName, 'Test Page', 2, mockCosenseSid
      );
      expect(result.content[0]?.text).toBeDefined();
    });

    it('hopCount省略時はデフォルトで1ホップになる', async () => {
      mockedCosense.getSmartContext.mockResolvedValue(mockOkResult);

      await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
      });

      expect(mockedCosense.getSmartContext).toHaveBeenCalledWith(
        mockProjectName, 'Test Page', 1, mockCosenseSid
      );
    });

    it('通常モードではレスポンス全文を返す', async () => {
      mockedCosense.getSmartContext.mockResolvedValue(mockOkResult);

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
      });

      expect(result.content[0]?.text).toBe(mockSmartContextText);
    });

    it('compactモードではPageList部分のみ返す', async () => {
      mockedCosense.getSmartContext.mockResolvedValue(mockOkResult);

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
        compact: true,
      });

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('<PageList>');
      expect(text).toContain('</PageList>');
      expect(text).not.toContain('GUIDE FOR AI AGENTS');
    });

    it('compactモードでPageListタグがない場合は全文を返す', async () => {
      const noTagResponse = 'プレーンテキストレスポンス（タグなし）';
      mockedCosense.getSmartContext.mockResolvedValue({ ok: true, text: noTagResponse });

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
        compact: true,
      });

      expect(result.content[0]?.text).toBe(noTagResponse);
    });

    it('projectNameオーバーライドが機能する', async () => {
      mockedCosense.getSmartContext.mockResolvedValue(mockOkResult);

      await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
        projectName: 'other-project',
      });

      expect(mockedCosense.getSmartContext).toHaveBeenCalledWith(
        'other-project', 'Test Page', 1, mockCosenseSid
      );
    });
  });

  describe('エラーケース', () => {
    it('COSENSE_SIDが未設定の場合は認証エラーを返す', async () => {
      const result = await handleGetSmartContext(mockProjectName, undefined, {
        title: 'Test Page',
      });

      expect(result.content[0]?.text).toContain('Authentication required');
      expect(mockedCosense.getSmartContext).not.toHaveBeenCalled();
    });

    it('APIが404エラーを返した場合はエラーメッセージを含む', async () => {
      mockedCosense.getSmartContext.mockResolvedValue({
        ok: false, error: 'API error: 404 Not Found'
      });

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'NonExistent Page',
      });

      expect(result.content[0]?.text).toContain('404 Not Found');
    });

    it('ネットワークエラーの場合はエラー詳細を含む', async () => {
      mockedCosense.getSmartContext.mockResolvedValue({
        ok: false, error: 'fetch failed'
      });

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
      });

      expect(result.content[0]?.text).toContain('fetch failed');
    });

    it('ハンドラー自体で例外が発生した場合はエラーレスポンスを返す', async () => {
      mockedCosense.getSmartContext.mockRejectedValue(new Error('Unexpected error'));

      const result = await handleGetSmartContext(mockProjectName, mockCosenseSid, {
        title: 'Test Page',
      });

      expect(result.content[0]?.text).toContain('Unexpected error');
    });

    it('COSENSE_SID未設定のcompactモードでもエラーが返る', async () => {
      const result = await handleGetSmartContext(mockProjectName, undefined, {
        title: 'Test Page',
        compact: true,
      });

      expect(result.content[0]?.text).toContain('Authentication required');
    });
  });
});
