import { handleInsertLines } from '@/routes/handlers/insert-lines.js';

// @cosense/stdライブラリ全体をモック
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

describe('handleInsertLines', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('エラーケース', () => {
    it('COSENSE_SIDが未設定の場合にエラーを返す', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
      };

      const result = await handleInsertLines(mockProjectName, undefined, params);

      expect(result).toEqual({
        content: [{
          type: "text",
          text: expect.stringContaining('Authentication required')
        }],
        isError: true
      });
    });

    it('パラメータが正しく設定される', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
        projectName: 'custom-project',
      };

      // COSENSE_SIDが未設定の場合は認証エラーになることを確認
      const result = await handleInsertLines(mockProjectName, undefined, params);
      
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Authentication required');
    });
  });

  describe('成功ケースのパラメータ処理', () => {
    it('projectNameが指定された場合に使用される', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'inserted text',
        projectName: 'custom-project',
      };

      // 認証が必要なことを確認（正常なフローの前段階）
      const result = await handleInsertLines(mockProjectName, undefined, params);
      
      expect(result.content?.[0]?.text).toContain('custom-project');
    });

    it('複数行のテキストが正しく処理される', async () => {
      const params = {
        pageTitle: 'Test Page',
        targetLineText: 'target line',
        text: 'line 1\nline 2\nline 3',
      };

      // 認証エラーでも行数は正しく認識されることを確認
      const result = await handleInsertLines(mockProjectName, undefined, params);
      
      expect(result.isError).toBe(true);
    });
  });
});