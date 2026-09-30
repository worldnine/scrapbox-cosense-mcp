import { fetch } from '@whatwg-node/fetch';
import type { BaseLine } from '@cosense/types/rest';
import { diffToEditChanges, writePage, type EditChange } from '@/page-writer.js';

jest.mock('@whatwg-node/fetch');
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn(),
}));

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

const line = (id: string, text: string): BaseLine => ({ id, text, userId: 'u', created: 0, updated: 0 });
const pageOf = (texts: string[]) => texts.map((text, i) => line(`id${i}`, text));

/** 編集 API がサーバー側でするのと同じ順に変更を当て、書き込み後の行を得る */
function applyChanges(before: BaseLine[], changes: EditChange[]): BaseLine[] {
  const lines = before.slice();
  for (const change of changes) {
    if ('_update' in change) {
      const i = lines.findIndex(l => l.id === change._update);
      expect(i).toBeGreaterThanOrEqual(0);
      lines[i] = { ...lines[i]!, text: change.lines.text };
    } else if ('_delete' in change) {
      const i = lines.findIndex(l => l.id === change._delete);
      expect(i).toBeGreaterThanOrEqual(0);
      lines.splice(i, 1);
    } else if ('_insert' in change) {
      const i = change._insert === '_end' ? lines.length : lines.findIndex(l => l.id === change._insert);
      expect(i).toBeGreaterThanOrEqual(0);
      lines.splice(i, 0, line(change.lines.id, change.lines.text));
    } else {
      throw new Error('unexpected page deletion');
    }
  }
  return lines;
}

describe('diffToEditChanges', () => {
  const roundTrip = (oldTexts: string[], newTexts: string[], cellCap?: number) => {
    const before = pageOf(oldTexts);
    const changes = diffToEditChanges(before, newTexts, cellCap);
    const after = applyChanges(before, changes);
    expect(after.map(l => l.text)).toEqual(newTexts);
    return { before, changes, after };
  };

  test('変わらなければ変更は空', () => {
    expect(diffToEditChanges(pageOf(['t', 'a', 'b']), ['t', 'a', 'b'])).toEqual([]);
  });

  test('途中への挿入は次に残る行の直前に入れる', () => {
    const { changes } = roundTrip(['t', 'a', 'b'], ['t', 'a', 'x', 'y', 'b']);
    expect(changes).toEqual([
      { _insert: 'id2', lines: { id: expect.stringMatching(/^[0-9a-f]{24}$/), text: 'x' } },
      { _insert: 'id2', lines: { id: expect.stringMatching(/^[0-9a-f]{24}$/), text: 'y' } },
    ]);
  });

  test('末尾への追加は _end に入れる', () => {
    const { changes } = roundTrip(['t', 'a'], ['t', 'a', 'z']);
    expect(changes).toEqual([{ _insert: '_end', lines: { id: expect.any(String), text: 'z' } }]);
  });

  test('1行の書き換えは行IDを保った _update になる', () => {
    const { changes } = roundTrip(['t', 'a', 'b'], ['t', 'A', 'b']);
    expect(changes).toEqual([{ _update: 'id1', lines: { text: 'A' } }]);
  });

  test('削除は _delete になる', () => {
    const { changes } = roundTrip(['t', 'a', 'b', 'c'], ['t', 'c']);
    expect(changes).toEqual([{ _delete: 'id1' }, { _delete: 'id2' }]);
  });

  test('n行をm行に置き換えると、対になる分は書き換え、余りは挿入か削除になる', () => {
    const grow = roundTrip(['t', 'a', 'b', 'end'], ['t', 'x', 'y', 'z', 'end']).changes;
    expect(grow.filter(c => '_update' in c)).toHaveLength(2);
    expect(grow.filter(c => '_insert' in c)).toEqual([{ _insert: 'id3', lines: { id: expect.any(String), text: 'z' } }]);

    const shrink = roundTrip(['t', 'a', 'b', 'c', 'end'], ['t', 'x', 'end']).changes;
    expect(shrink).toEqual([{ _update: 'id1', lines: { text: 'x' } }, { _delete: 'id2' }, { _delete: 'id3' }]);
  });

  test('同じ文字の行が並んでも、変わらない行のIDは残る', () => {
    const { before, after } = roundTrip(['t', '', 'a', '', 'b', ''], ['t', '', 'a', 'new', '', 'b', '']);
    const kept = after.filter(l => before.some(b => b.id === l.id));
    expect(kept).toHaveLength(before.length);
  });

  test('表の上限を超えると先頭から順に対にする（結果は同じ）', () => {
    roundTrip(['t', 'a', 'b', 'c', 'd'], ['t', 'x', 'b', 'y'], 1);
  });

  test('ばらばらな変更でも書き込み後の行と一致する', () => {
    // 疑似乱数で固定の入力を作る（毎回同じ）
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const vocab = ['', 'a', 'b', 'c', ' d', '[link]'];
    for (let round = 0; round < 200; round++) {
      const oldTexts = ['title', ...Array.from({ length: rand(8) }, () => vocab[rand(vocab.length)]!)];
      const newTexts = ['title', ...Array.from({ length: rand(8) }, () => vocab[rand(vocab.length)]!)];
      roundTrip(oldTexts, newTexts);
    }
  });
});

describe('writePage', () => {
  const project = 'test-project';
  const title = 'Test Page';
  const pageUrl = `https://scrapbox.io/api/pages/v2/${project}/Test%20Page`;
  const previewUrl = `https://scrapbox.io/api/pages/v2/${project}/page-edit-for-ai/preview`;
  const submitUrl = `https://scrapbox.io/api/pages/v2/${project}/page-edit-for-ai/submit`;

  const json = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);

  const existingPage = { id: 'page1', persistent: true, lines: pageOf(['Test Page', 'a', 'b']) };

  /** GET はページを、preview と submit は順に答えを返す */
  const respond = (page: unknown, posts: Response[]) => {
    const queue = posts.slice();
    mockedFetch.mockImplementation(((url: string, init?: RequestInit) => {
      if (!init || init.method !== 'POST') return Promise.resolve(json(page));
      const next = queue.shift();
      if (!next) throw new Error(`unexpected POST ${url}`);
      return Promise.resolve(next);
    }) as typeof fetch);
  };

  const postBodies = () => mockedFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse((init as RequestInit).body as string) }));

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COSENSE_PAT = 'test-pat';
  });

  afterEach(() => {
    delete process.env.COSENSE_PAT;
  });

  test('資格情報が無ければ書かずにエラーを返す', async () => {
    delete process.env.COSENSE_PAT;
    const result = await writePage(project, title, lines => lines);
    expect(result).toEqual({ ok: false, err: expect.stringContaining('Authentication required') });
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  test('SIDなら websocket の patch に任せる', async () => {
    delete process.env.COSENSE_PAT;
    mockedPatch.mockResolvedValue({ ok: true, val: 'commit' } as never);
    const update = (lines: BaseLine[]) => lines;

    const result = await writePage(project, title, update, 'test-sid');

    expect(result).toEqual({ ok: true });
    expect(mockedPatch).toHaveBeenCalledWith(project, title, update, { sid: 'test-sid' });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  test('SIDの patch が失敗すればそのエラーを返す', async () => {
    delete process.env.COSENSE_PAT;
    mockedPatch.mockResolvedValue({ ok: false, err: { name: 'SocketIOError', message: 'boom' } } as never);

    const result = await writePage(project, title, lines => lines, 'test-sid');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.err).toContain('boom');
  });

  test('PATなら preview と submit で差分を書き、PATのヘッダを付ける', async () => {
    respond(existingPage, [json({ previewId: 'p1' }), json({ commitId: 'c1' })]);

    const result = await writePage(project, title, lines => [...lines, { text: 'c' }], 'test-sid');

    expect(result).toEqual({ ok: true });
    expect(mockedPatch).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledWith(pageUrl, { headers: { 'x-personal-access-token': 'test-pat' } });
    expect(postBodies()).toEqual([
      { url: previewUrl, body: { pageId: 'page1', changes: [{ _insert: '_end', lines: { id: expect.any(String), text: 'c' } }] } },
      { url: submitUrl, body: { previewId: 'p1' } },
    ]);
    const previewInit = mockedFetch.mock.calls[1]![1] as RequestInit;
    expect(previewInit.headers).toEqual(expect.objectContaining({
      'x-personal-access-token': 'test-pat',
      'Content-Type': 'application/json',
    }));
  });

  test('受け取った行をそのまま返せば何も送らない', async () => {
    respond(existingPage, []);
    const result = await writePage(project, title, lines => lines);
    expect(result).toEqual({ ok: true });
    expect(postBodies()).toEqual([]);
  });

  test('中身が同じ新しい配列でも何も送らない', async () => {
    respond(existingPage, []);
    const result = await writePage(project, title, lines => lines.map(l => ({ text: l.text })));
    expect(result).toEqual({ ok: true });
    expect(postBodies()).toEqual([]);
  });

  test('改行を含む要素は複数行に分ける', async () => {
    respond(existingPage, [json({ previewId: 'p1' }), json({})]);
    await writePage(project, title, lines => [...lines, { text: 'x\ny' }]);
    expect(postBodies()[0]!.body.changes.map((c: { lines: { text: string } }) => c.lines.text)).toEqual(['x', 'y']);
  });

  test('まだ無いページは pageId を付けずに全行を挿入する（新規作成）', async () => {
    respond({ id: 'tmp', persistent: false, lines: pageOf(['Test Page']) }, [json({ previewId: 'p1' }), json({})]);

    await writePage(project, title, () => [{ text: 'Test Page' }, { text: 'body' }]);

    expect(postBodies()[0]!.body).toEqual({
      changes: [
        { _insert: '_end', lines: { id: expect.any(String), text: 'Test Page' } },
        { _insert: '_end', lines: { id: expect.any(String), text: 'body' } },
      ],
    });
  });

  test('空配列はページの削除として送る', async () => {
    respond(existingPage, [json({ previewId: 'p1' }), json({})]);
    await writePage(project, title, () => []);
    expect(postBodies()[0]!.body).toEqual({ pageId: 'page1', changes: [{ deleted: true }] });
  });

  test('まだ無いページを空にしようとしても何も送らない', async () => {
    respond({ id: 'tmp', persistent: false, lines: pageOf(['Test Page']) }, []);
    const result = await writePage(project, title, () => []);
    expect(result).toEqual({ ok: true });
    expect(postBodies()).toEqual([]);
  });

  test('NotFastForward なら読み直してやり直し、更新関数をもう一度呼ぶ', async () => {
    respond(existingPage, [
      json({ error: 'NotFastForward' }, 409),
      json({ previewId: 'p2' }),
      json({}),
    ]);
    const update = jest.fn((lines: BaseLine[]) => [...lines, { text: 'c' }]);

    const result = await writePage(project, title, update);

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledTimes(2);
    expect(postBodies().map(p => p.url)).toEqual([previewUrl, previewUrl, submitUrl]);
  });

  test('submit で NotFastForward でもやり直す', async () => {
    respond(existingPage, [
      json({ previewId: 'p1' }),
      json({ error: 'NotFastForward' }, 409),
      json({ previewId: 'p2' }),
      json({}),
    ]);
    const result = await writePage(project, title, lines => [...lines, { text: 'c' }]);
    expect(result).toEqual({ ok: true });
    expect(postBodies().map(p => p.body.previewId).filter(Boolean)).toEqual(['p1', 'p2']);
  });

  test('衝突が続けば3回で諦める', async () => {
    const conflict = () => json({ error: 'NotFastForward' }, 409);
    respond(existingPage, [conflict(), conflict(), conflict()]);
    const result = await writePage(project, title, lines => [...lines, { text: 'c' }]);
    expect(result).toEqual({ ok: false, err: expect.stringContaining('NotFastForward') });
  });

  test('それ以外のエラーはそのまま返す', async () => {
    respond(existingPage, [json({ error: 'DuplicateTitle' }, 409)]);
    const result = await writePage(project, title, lines => [...lines, { text: 'c' }]);
    expect(result).toEqual({ ok: false, err: 'Edit API returned HTTP 409: DuplicateTitle' });
  });

  test('ページを読めなければエラーを返す', async () => {
    mockedFetch.mockResolvedValue(json({}, 403));
    const result = await writePage(project, title, lines => [...lines, { text: 'c' }]);
    expect(result).toEqual({ ok: false, err: 'Failed to read the page: HTTP 403' });
  });

  test('Service Account なら専用のヘッダを付ける', async () => {
    delete process.env.COSENSE_PAT;
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { resetCredentialCache } = await import('@/utils/auth.js');
    const dir = join(process.env.HOME!, '.cosense');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({
      projects: [{ url: `https://scrapbox.io/${project}`, serviceAccount: 'cs_key' }],
    }));
    resetCredentialCache();
    try {
      respond(existingPage, [json({ previewId: 'p1' }), json({})]);
      await writePage(project, title, lines => [...lines, { text: 'c' }]);
      expect(mockedFetch).toHaveBeenCalledWith(pageUrl, { headers: { 'x-service-account-access-key': 'cs_key' } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
      resetCredentialCache();
    }
  });
});
