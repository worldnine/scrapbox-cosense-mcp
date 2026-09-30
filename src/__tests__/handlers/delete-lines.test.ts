import { handleDeleteLines } from '@/routes/handlers/delete-lines.js';

jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

describe('handleDeleteLines', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('エラーケース', () => {
    it('COSENSE_SIDが未設定の場合に認証エラーを返す', async () => {
      const result = await handleDeleteLines(mockProjectName, undefined, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Authentication required');
      expect(result.content?.[0]?.text).toContain('delete_lines');
    });

    it('対象行が見つからない場合にエラーを返す', async () => {
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'something else', id: 'l2' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'no match',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Target line not found');
    });

    it('patch が Result.Err を返した場合にエラーレスポンスを返す', async () => {
      mockedPatch.mockResolvedValue({ ok: false, val: null, err: 'Conflict' } as any);

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('WebSocket patch failed');
    });
  });

  describe('正常ケース', () => {
    it('完全一致した1行を削除する', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        const mockLines = [
          { text: 'Test Page', id: 'l1' },
          { text: 'delete me', id: 'l2' },
          { text: 'keep me', id: 'l3' },
        ] as any;
        captured = updateFn(mockLines);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'delete me',
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'keep me']);
      expect(result.content?.[0]?.text).toContain('Successfully deleted line(s)');
      expect(result.content?.[0]?.text).toContain('Lines removed: 1');
    });

    it('複数行ブロックをまとめて削除する (n行)', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        captured = updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'old1', id: 'l2' },
          { text: 'old2', id: 'l3' },
          { text: 'keep', id: 'l4' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old1\nold2',
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'keep']);
      expect(result.content?.[0]?.text).toContain('Matches removed: 1');
      expect(result.content?.[0]?.text).toContain('Lines removed: 2');
    });

    it('matchAll=false (デフォルト) では最初の1件のみ削除する', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        captured = updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'dup', id: 'l2' },
          { text: 'keep', id: 'l3' },
          { text: 'dup', id: 'l4' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'dup',
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'keep', 'dup']);
      expect(result.content?.[0]?.text).toContain('Lines removed: 1');
    });

    it('matchAll=true では全件削除する (非重複)', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        captured = updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'a', id: 'l2' },
          { text: 'a', id: 'l3' },
          { text: 'a', id: 'l4' },
          { text: 'a', id: 'l5' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'a\na',
        matchAll: true,
      });

      // 非重複で index 0 と 2 がマッチし、4行とも削除される
      expect(captured.map(l => l.text)).toEqual(['Test Page']);
      expect(result.content?.[0]?.text).toContain('Lines removed: 4');
    });

    it('compact モードでは短いメッセージを返す', async () => {
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'old', id: 'l2' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        compact: true,
      });

      expect(result.content?.[0]?.text).toBe('deleted: 1 line(s) in Test Page');
    });
  });

  describe('タイトル行削除ガード', () => {
    it('全行を削除しようとするとエラーになり、ページを変更しない', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        const mockLines = [
          { text: 'Test Page', id: 'l1' },
          { text: 'a', id: 'l2' },
          { text: 'b', id: 'l3' },
        ] as any;
        captured = updateFn(mockLines);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'Test Page\na\nb',
      });

      // ページは変更されない（元の行のまま）
      expect(captured.map(l => l.text)).toEqual(['Test Page', 'a', 'b']);
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('delete_page');
    });

    it('タイトル行だけを削除しようとするとエラーになり、ページを変更しない (暗黙リネーム防止)', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        const mockLines = [
          { text: 'Test Page', id: 'l1' },
          { text: 'keep 1', id: 'l2' },
          { text: 'keep 2', id: 'l3' },
        ] as any;
        captured = updateFn(mockLines);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleDeleteLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'Test Page',
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'keep 1', 'keep 2']);
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('title line');
    });
  });
});
