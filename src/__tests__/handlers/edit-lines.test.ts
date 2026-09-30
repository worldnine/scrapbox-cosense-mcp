import { handleEditLines } from '@/routes/handlers/edit-lines.js';

jest.mock('@/utils/markdown-converter.js', () => ({
  convertMarkdownToScrapbox: jest.fn((text) => Promise.resolve(text))
}));

jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

describe('handleEditLines', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('エラーケース', () => {
    it('COSENSE_SIDが未設定の場合に認証エラーを返す', async () => {
      const result = await handleEditLines(mockProjectName, undefined, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        newText: 'new',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Authentication required');
      expect(result.content?.[0]?.text).toContain('edit_lines');
    });

    it('対象行が見つからない場合にエラーを返す', async () => {
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'something else', id: 'l2' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'no match',
        newText: 'new',
        format: 'scrapbox',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Target line not found');
    });

    it('patch が Result.Err を返した場合にエラーレスポンスを返す', async () => {
      mockedPatch.mockResolvedValue({ ok: false, val: null, err: 'Conflict' } as any);

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        newText: 'new',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('WebSocket patch failed');
    });
  });

  describe('正常ケース', () => {
    it('完全一致した1行を新しい内容に置換する', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        const mockLines = [
          { text: 'Test Page', id: 'l1' },
          { text: 'old line', id: 'l2' },
          { text: 'keep me', id: 'l3' },
        ] as any;
        captured = updateFn(mockLines);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old line',
        newText: 'new line',
        format: 'scrapbox',
      });

      expect(captured.map(l => l.text)).toEqual([
        'Test Page',
        'new line',
        'keep me',
      ]);
      expect(result.content?.[0]?.text).toContain('Successfully edited line(s)');
      expect(result.content?.[0]?.text).toContain('Matches replaced: 1');
    });

    it('複数行で置換できる', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        captured = updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'old', id: 'l2' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        newText: 'a\nb\nc',
        format: 'scrapbox',
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'a', 'b', 'c']);
    });

    it('matchAll=false (デフォルト) では最初の1件のみ置換する', async () => {
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

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'dup',
        newText: 'replaced',
        format: 'scrapbox',
      });

      expect(captured.map(l => l.text)).toEqual([
        'Test Page',
        'replaced',
        'keep',
        'dup',
      ]);
      expect(result.content?.[0]?.text).toContain('Matches replaced: 1');
    });

    it('matchAll=true では全件置換する', async () => {
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

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'dup',
        newText: 'replaced',
        format: 'scrapbox',
        matchAll: true,
      });

      expect(captured.map(l => l.text)).toEqual([
        'Test Page',
        'replaced',
        'keep',
        'replaced',
      ]);
      expect(result.content?.[0]?.text).toContain('Matches replaced: 2');
    });

    it('部分一致では置換されない (完全一致のみ)', async () => {
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'my old line', id: 'l2' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        newText: 'new',
        format: 'scrapbox',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Target line not found');
    });

    it('複数行ブロックを1行に置換できる (n行 → 1行)', async () => {
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

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old1\nold2',
        newText: 'new',
        format: 'scrapbox',
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'new', 'keep']);
      expect(result.content?.[0]?.text).toContain('Matches replaced: 1');
    });

    it('複数行ブロックを複数行に置換できる (n行 → m行)', async () => {
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

      await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old1\nold2',
        newText: 'new1\nnew2\nnew3',
        format: 'scrapbox',
      });

      expect(captured.map(l => l.text)).toEqual([
        'Test Page',
        'new1',
        'new2',
        'new3',
        'keep',
      ]);
    });

    it('ブロックが完全一致しない場合はエラーになる', async () => {
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([
          { text: 'Test Page', id: 'l1' },
          { text: 'a', id: 'l2' },
          { text: 'b', id: 'l3' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'a\nx',
        newText: 'new',
        format: 'scrapbox',
      });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain('Target line not found');
    });

    it('matchAll=true のブロック一致は非重複で全件置換する', async () => {
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

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'a\na',
        newText: 'x',
        format: 'scrapbox',
        matchAll: true,
      });

      expect(captured.map(l => l.text)).toEqual(['Test Page', 'x', 'x']);
      expect(result.content?.[0]?.text).toContain('Matches replaced: 2');
    });

    it('matchAll=true でも重複ブロックは1回として扱わない (非重複)', async () => {
      let captured: any[] = [];
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        captured = updateFn([
          { text: 'a', id: 'l1' },
          { text: 'a', id: 'l2' },
          { text: 'a', id: 'l3' },
        ] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'a\na',
        newText: 'x',
        format: 'scrapbox',
        matchAll: true,
      });

      // 3連続の 'a' に対し 'a\na' は index 0 で1回だけマッチし、後続探索は index 2 から再開されるため残る 'a' は単独で残る
      expect(captured.map(l => l.text)).toEqual(['x', 'a']);
      expect(result.content?.[0]?.text).toContain('Matches replaced: 1');
    });

    it('markdown 変換が呼ばれる (format 未指定時)', async () => {
      const { convertMarkdownToScrapbox } = await import('@/utils/markdown-converter.js');
      const mockedConvert = convertMarkdownToScrapbox as jest.MockedFunction<typeof convertMarkdownToScrapbox>;
      mockedConvert.mockResolvedValue('converted');

      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([{ text: 'old', id: 'l1' }] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        newText: '# header',
      });

      expect(mockedConvert).toHaveBeenCalledWith('# header', {
        convertNumberedLists: false,
      });
    });

    it('compact モードでは短いメッセージを返す', async () => {
      mockedPatch.mockImplementation(async (_project, _title, updateFn) => {
        updateFn([{ text: 'old', id: 'l1' }] as any);
        return { ok: true, val: 'commitId', err: null };
      });

      const result = await handleEditLines(mockProjectName, mockCosenseSid, {
        pageTitle: 'Test Page',
        targetLineText: 'old',
        newText: 'new',
        format: 'scrapbox',
        compact: true,
      });

      expect(result.content?.[0]?.text).toBe('edited: 1 line(s) in Test Page');
    });
  });
});
