import { fetch } from '@whatwg-node/fetch';
import { handleCreatePage } from '@/routes/handlers/create-page.js';
import { handleInsertLines } from '@/routes/handlers/insert-lines.js';
import { handleEditLines } from '@/routes/handlers/edit-lines.js';
import { handleDeleteLines } from '@/routes/handlers/delete-lines.js';
import { handleDeletePage } from '@/routes/handlers/delete-page.js';
import { handleRewritePage } from '@/routes/handlers/rewrite-page.js';

// PAT だけ（SID なし）で、各ハンドラが websocket ではなく編集 API まで届くことを確かめる
jest.mock('@whatwg-node/fetch');
jest.mock('@cosense/std/websocket', () => ({ patch: jest.fn() }));
jest.mock('@/utils/markdown-converter.js', () => ({
  convertMarkdownToScrapbox: jest.fn((text: string) => Promise.resolve(text)),
}));

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
let mockedPatch: jest.Mock;
beforeAll(async () => {
  mockedPatch = (await import('@cosense/std/websocket')).patch as unknown as jest.Mock;
});

const project = 'test-project';
const json = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
} as unknown as Response);

const pageLines = (texts: string[]) => texts.map((text, i) => ({ id: `id${i}`, text, userId: 'u', created: 0, updated: 0 }));
const existing = {
  id: 'page1',
  title: 'Page',
  persistent: true,
  lines: pageLines(['Page', 'first', 'second']),
  created: 0,
  updated: 0,
  links: [],
  user: { id: 'u', name: 'u', displayName: 'U', photo: '' },
  collaborators: [],
};

/** GET はページ、preview は previewId、submit は空の成功を返す */
const serve = (page: unknown) => {
  mockedFetch.mockImplementation(((_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return Promise.resolve(json(page));
    const body = JSON.parse(init.body as string);
    return Promise.resolve(json(body.previewId ? {} : { previewId: 'p1' }));
  }) as typeof fetch);
};

const previews = () => mockedFetch.mock.calls
  .filter(([url]) => String(url).endsWith('/page-edit-for-ai/preview'))
  .map(([, init]) => JSON.parse((init as RequestInit).body as string));

describe('PATでの書き込み', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COSENSE_PAT = 'test-pat';
    process.env.COSENSE_ENABLE_DELETE = 'true';
  });

  afterEach(() => {
    delete process.env.COSENSE_PAT;
    delete process.env.COSENSE_ENABLE_DELETE;
  });

  test('資格情報が何も無ければ、COSENSE_PAT と COSENSE_SID を案内して止める', async () => {
    delete process.env.COSENSE_PAT;
    const result = await handleInsertLines(project, undefined, { pageTitle: 'Page', targetLineText: 'first', text: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('COSENSE_PAT or COSENSE_SID');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  test('insert_lines', async () => {
    serve(existing);
    const result = await handleInsertLines(project, undefined, { pageTitle: 'Page', targetLineText: 'first', text: 'x' });
    expect(result.isError).toBeUndefined();
    expect(previews()).toEqual([{ pageId: 'page1', changes: [{ _insert: 'id2', lines: { id: expect.any(String), text: 'x' } }] }]);
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  test('edit_lines', async () => {
    serve(existing);
    const result = await handleEditLines(project, undefined, { pageTitle: 'Page', targetLineText: 'second', newText: 'SECOND' });
    expect(result.isError).toBeUndefined();
    expect(previews()).toEqual([{ pageId: 'page1', changes: [{ _update: 'id2', lines: { text: 'SECOND' } }] }]);
  });

  test('edit_lines で見つからなければ何も送らない', async () => {
    serve(existing);
    const result = await handleEditLines(project, undefined, { pageTitle: 'Page', targetLineText: 'missing', newText: 'x' });
    expect(result.content[0]?.text).toContain('Target line not found');
    expect(previews()).toEqual([]);
  });

  test('delete_lines', async () => {
    serve(existing);
    const result = await handleDeleteLines(project, undefined, { pageTitle: 'Page', targetLineText: 'first' });
    expect(result.isError).toBeUndefined();
    expect(previews()).toEqual([{ pageId: 'page1', changes: [{ _delete: 'id1' }] }]);
  });

  test('create_page は pageId なしで作る', async () => {
    serve({ ...existing, id: 'tmp', persistent: false, lines: pageLines(['New']) });
    const result = await handleCreatePage(project, undefined, { title: 'New', body: 'body', format: 'scrapbox' });
    expect(result.isError).toBeUndefined();
    expect(previews()).toEqual([{
      changes: [
        { _insert: '_end', lines: { id: expect.any(String), text: 'New' } },
        { _insert: '_end', lines: { id: expect.any(String), text: 'body' } },
      ],
    }]);
  });

  test('delete_page は削除を送る', async () => {
    serve(existing);
    const result = await handleDeletePage(project, undefined, { pageTitle: 'Page' });
    expect(result.isError).toBeUndefined();
    expect(previews()).toEqual([{ pageId: 'page1', changes: [{ deleted: true }] }]);
  });

  test('rewrite_page はタイトル行を残して差分を送る', async () => {
    serve(existing);
    const result = await handleRewritePage(project, undefined, { pageTitle: 'Page', body: 'first\nthird', format: 'scrapbox' });
    expect(result.isError).toBeUndefined();
    expect(previews()).toEqual([{ pageId: 'page1', changes: [{ _update: 'id2', lines: { text: 'third' } }] }]);
  });
});
