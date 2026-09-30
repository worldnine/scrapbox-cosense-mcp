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
    user: mockPageResponse.user,
    lastUpdateUser: mockPageResponse.lastUpdateUser,
    collaborators: mockPageResponse.collaborators,
    links: mockPageResponse.links,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // 名前を引く処理は素通しにする（名前は mockPageResponse に最初から入れてある）
    mockedCosense.withUserNames.mockImplementation(async (_project, pages) => pages);
  });

  describe('作成者・編集者', () => {
    test('user を作成者、lastUpdateUser を最終編集者として出すこと（@cosense/types の定義どおり）', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const result = await handleGetPage(mockProjectName, mockCosenseSid, { pageTitle: 'Test Page' });

      expect(result.content[0]?.text).toContain('Created user: Test User');
      expect(result.content[0]?.text).toContain('Last editor: Update User');
      expect(result.content[0]?.text).toContain('Other editors: Collab User');
      expect(mockedCosense.withUserNames).toHaveBeenCalledWith(mockProjectName, [mockPageResponse], mockCosenseSid);
    });

    test('名前が引けなければ、作成者・編集者の行を出さないこと（undefined と出さない）', async () => {
      const idsOnly = {
        ...mockPageResponse,
        user: { id: 'user1' },
        lastUpdateUser: { id: 'user2' },
        collaborators: undefined,
        users: [{ id: 'user1' }],
      } as unknown as typeof mockPageResponse;
      mockedCosense.getPage.mockResolvedValue(idsOnly);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const result = await handleGetPage(mockProjectName, mockCosenseSid, { pageTitle: 'Test Page' });

      expect(result.content[0]?.text).not.toContain('Created user');
      expect(result.content[0]?.text).not.toContain('Last editor');
      expect(result.content[0]?.text).not.toContain('undefined');
    });

    test('compact では名前を出さないので、メンバー一覧を引かないこと', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      await handleGetPage(mockProjectName, mockCosenseSid, { pageTitle: 'Test Page', compact: true });

      expect(mockedCosense.withUserNames).not.toHaveBeenCalled();
    });
  });

  describe('正常ケース', () => {
    test('ページ情報が正常に取得されること', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const params = { pageTitle: 'Test Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('Title: Test Page');
      expect(result.content[0]?.text).toContain('Line 1');
      expect(result.content[0]?.text).toContain('Line 2');

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

      expect(result.content[0]?.text).toContain('Title: Test Page');
    });

    test('オプショナルprojectNameパラメータが使用されること', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const params = { pageTitle: 'Test Page', projectName: 'custom-project' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      // getPageが指定されたprojectNameで呼び出されることを確認
      expect(mockedCosense.getPage).toHaveBeenCalledWith('custom-project', 'Test Page', mockCosenseSid);
      expect(result.content[0]?.text).toContain('Title: Test Page');
    });

    test('projectNameが未指定の場合はデフォルトプロジェクト名が使用されること', async () => {
      mockedCosense.getPage.mockResolvedValue(mockPageResponse);
      mockedCosense.toReadablePage.mockReturnValue(mockReadablePageResponse);

      const params = { pageTitle: 'Test Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      // getPageがデフォルトprojectNameで呼び出されることを確認
      expect(mockedCosense.getPage).toHaveBeenCalledWith(mockProjectName, 'Test Page', mockCosenseSid);
      expect(result.content[0]?.text).toContain('Title: Test Page');
    });
  });

  describe('collaboratorsがundefinedの場合', () => {
    test('collaboratorsがundefinedの場合でもエラーにならないこと', async () => {
      const pageWithoutCollaborators = {
        ...mockPageResponse,
        collaborators: undefined as unknown as typeof mockPageResponse.collaborators,
      };
      const readableWithoutCollaborators = {
        ...mockReadablePageResponse,
        collaborators: undefined as unknown as typeof mockReadablePageResponse.collaborators,
      };
      mockedCosense.getPage.mockResolvedValue(pageWithoutCollaborators);
      mockedCosense.toReadablePage.mockReturnValue(readableWithoutCollaborators);

      const params = { pageTitle: 'Test Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toContain('Title: Test Page');
      // 他の編集者がいなければ、その行は出さない
      expect(result.content[0]?.text).not.toContain('Other editors');
    });
  });

  describe('エラーケース', () => {
    test('ページが見つからない場合にエラーレスポンスを返すこと', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const params = { pageTitle: 'Nonexistent Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Page \"Nonexistent Page\" not found');
      expect(result.content[0]?.text).toContain('Operation: get_page');
      expect(result.content[0]?.text).toContain(`Project: ${mockProjectName}`);
    });

    test('空のページタイトルが正しく処理されること', async () => {
      mockedCosense.getPage.mockResolvedValue(null);

      const params = { pageTitle: '' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Page \"\" not found');
    });

    test('APIエラーが発生した場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'API Error';
      mockedCosense.getPage.mockRejectedValue(new Error(errorMessage));

      const params = { pageTitle: 'Test Page' };
      const result = await handleGetPage(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Error:');
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });
});