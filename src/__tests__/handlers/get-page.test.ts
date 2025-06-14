import { handleGetPage } from '@/routes/handlers/get-page.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('handleGetPage', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  const mockPageResponse = {
    id: 'page1',
    title: 'Test Page',
    lines: [
      { id: 'line1', text: 'Line 1', userId: 'user1', created: 1700000000, updated: 1700000000 },
      { id: 'line2', text: 'Line 2', userId: 'user2', created: 1700000000, updated: 1700000000 },
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
    collaborators: [
      {
        id: 'user3',
        name: 'collabuser',
        displayName: 'Collab User',
        photo: 'photo3.jpg',
      },
    ],
  };

  const mockReadablePageResponse = {
    title: 'Test Page',
    lines: mockPageResponse.lines,
    created: mockPageResponse.created,
    updated: mockPageResponse.updated,
    user: mockPageResponse.lastUpdateUser, // lastUpdateUserがcreated userとして扱われる
    lastUpdateUser: mockPageResponse.user, // userがlast editorとして扱われる
    collaborators: mockPageResponse.collaborators,
    links: mockPageResponse.links,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常ケース', () => {
    test('ページ情報が正常に取得されること', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const params = { pageTitle: 'Test Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Title: Test Page');
      expect(result.content[0].text).toContain('Line 1');
      expect(result.content[0].text).toContain('Line 2');

      expect(mockedCosense.getPage).toHaveBeenCalledWith(
        mockProjectName,
        'Test Page',
        mockCosenseSid
      );
      expect(mockedCosense.toReadablePage).toHaveBeenCalledWith(mockPageResponse);
    });

    test('基本的な動作確認', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const params = { pageTitle: 'Simple Test' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.content[0].text).toContain('Title: Test Page');
    });
  });

  describe('エラーケース', () => {
    test('ページが見つからない場合にエラーレスポンスを返すこと', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const params = { pageTitle: 'Nonexistent Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Page \"Nonexistent Page\" not found');
      expect(result.content[0].text).toContain('Operation: get_page');
      expect(result.content[0].text).toContain(`Project: ${mockProjectName}`);
    });

    test('空のページタイトルが正しく処理されること', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const params = { pageTitle: '' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Page \"\" not found');
    });

    test('APIエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'API Error';
      mockedCosense.getPage.mockRejectedValue(new Error(errorMessage));

      const params = { pageTitle: 'Test Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error details:');
      expect(result.content[0].text).toContain(errorMessage);
    });
  });
});