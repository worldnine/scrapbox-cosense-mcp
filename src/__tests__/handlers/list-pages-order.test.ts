import { handleListPages } from '@/routes/handlers/list-pages.js';
import { clearMembersCache } from '@/cosense.js';
import { formatYmd } from '@/utils/format.js';
import { fetch } from '@whatwg-node/fetch';

jest.mock('@whatwg-node/fetch');
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

const pages = [
  { title: 'テスト', created: 1, updated: 1700003000 },
  { title: '手順4の確認', created: 200, updated: 1600002000 },
  { title: 'test2026/09/14', created: 100, updated: 1500001000 },
];

function respond(batch: Array<(typeof pages)[number] & { pin?: number }>, count = batch.length, skip = 0) {
  mockedFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ projectName: 'test-project', count, skip, limit: 3, pages: batch }),
  } as Response);
}

beforeEach(() => {
  jest.resetAllMocks();
  clearMembersCache();
});

test.each([false, true])('sort未指定の表示と並び順がupdatedで揃うこと（compact=%s）', async compact => {
  respond(pages);
  const result = await handleListPages('test-project', undefined, { limit: 3, compact });
  const text = result.content[0]?.text ?? '';

  expect(text).toContain(compact ? 'sort:updated' : 'Sort method: Sorted by last updated');
  expect(text).not.toContain('Not specified');
  expect(text).toContain(formatYmd(new Date(pages[0]!.updated * 1000)));
  expect(text.indexOf('テスト')).toBeLessThan(text.indexOf('手順4の確認'));
  expect(text.indexOf('手順4の確認')).toBeLessThan(text.indexOf('test2026/09/14'));
});

test.each(['updated', 'created'])('ピン留め除外でsort=%sと取得位置を保ちメタデータを再取得しないこと', async sort => {
  respond([{ ...pages[0]!, pin: 1 }, pages[1]!], 10, 4);
  respond([pages[2]!], 10, 6);
  const result = await handleListPages('test-project', undefined, {
    sort, excludePinned: true, skip: 4, limit: 2, compact: true,
  });
  const text = result.content[0]?.text ?? '';

  expect(text).toContain('2 unpinned (10 total)');
  expect(text).not.toContain('テスト');
  expect(text.indexOf('手順4の確認')).toBeLessThan(text.indexOf('test2026/09/14'));
  expect(mockedFetch).toHaveBeenCalledTimes(2);
  expect(mockedFetch.mock.calls.map(call => {
    const url = new URL(String(call[0]));
    return [url.searchParams.get('sort'), url.searchParams.get('skip')];
  })).toEqual([[sort, '4'], [sort, '6']]);
});

test.each([{ batch: [] }, { batch: pages.map(page => ({ ...page, pin: 1 })) }])(
  'ピン留め除外で末尾に達したら追加の一覧要求をしないこと（%j）', async ({ batch }) => {
    respond(batch);
    const result = await handleListPages('test-project', undefined, {
      excludePinned: true, limit: 10, compact: true,
    });

    expect(result.content[0]?.text).toContain(`0 unpinned (${batch.length} total)`);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  }
);

test.each([false, true])('sort未指定の一覧表示でもピン留めを更新順に混ぜること（compact=%s）', async compact => {
  respond([{ ...pages[2]!, pin: 1 }, pages[0]!, pages[1]!]);
  const result = await handleListPages('test-project', undefined, { limit: 3, compact });
  const text = result.content[0]?.text ?? '';
  expect(text.indexOf('テスト')).toBeLessThan(text.indexOf('手順4の確認'));
  expect(text.indexOf('手順4の確認')).toBeLessThan(text.indexOf('test2026/09/14'));
  expect(text).not.toContain('Not specified');
  expect(mockedFetch.mock.calls.filter(call =>
    new URL(String(call[0])).pathname === '/api/pages/test-project'
  )).toHaveLength(1);
});
