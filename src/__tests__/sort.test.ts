import { sortPages } from '@/utils/sort.js';
import type { ScrapboxPage } from '@/types/api.js';

describe('sortPages', () => {
  const mockPages: ScrapboxPage[] = [
    {
      title: 'Page A',
      created: 1000,
      updated: 2000,
      accessed: 3000,
      views: 100,
      linked: 5,
      pin: 1,
    },
    {
      title: 'Page B',
      created: 2000,
      updated: 1000,
      accessed: 2000,
      views: 200,
      linked: 3,
    },
    {
      title: 'Page C',
      created: 1500,
      updated: 3000,
      accessed: 1000,
      views: 50,
      linked: 10,
    },
  ];

  describe('基本的なソート機能', () => {
    test('updated でソートされること', () => {
      const result = sortPages(mockPages, { sort: 'updated' });
      expect(result[0]?.title).toBe('Page C'); // updated: 3000
      expect(result[1]?.title).toBe('Page A'); // updated: 2000
      expect(result[2]?.title).toBe('Page B'); // updated: 1000
    });

    test('created でソートされること', () => {
      const result = sortPages(mockPages, { sort: 'created' });
      expect(result[0]?.title).toBe('Page B'); // created: 2000
      expect(result[1]?.title).toBe('Page C'); // created: 1500
      expect(result[2]?.title).toBe('Page A'); // created: 1000
    });

    test('accessed でソートされること', () => {
      const result = sortPages(mockPages, { sort: 'accessed' });
      expect(result[0]?.title).toBe('Page A'); // accessed: 3000
      expect(result[1]?.title).toBe('Page B'); // accessed: 2000
      expect(result[2]?.title).toBe('Page C'); // accessed: 1000
    });

    test('views でソートされること', () => {
      const result = sortPages(mockPages, { sort: 'views' });
      expect(result[0]?.title).toBe('Page B'); // views: 200
      expect(result[1]?.title).toBe('Page A'); // views: 100
      expect(result[2]?.title).toBe('Page C'); // views: 50
    });

    test('linked でソートされること', () => {
      const result = sortPages(mockPages, { sort: 'linked' });
      expect(result[0]?.title).toBe('Page C'); // linked: 10
      expect(result[1]?.title).toBe('Page A'); // linked: 5
      expect(result[2]?.title).toBe('Page B'); // linked: 3
    });

    test('title でソートされること', () => {
      const result = sortPages(mockPages, { sort: 'title' });
      expect(result[0]?.title).toBe('Page A');
      expect(result[1]?.title).toBe('Page B');
      expect(result[2]?.title).toBe('Page C');
    });
  });

  describe('ピン留めページのフィルタリング', () => {
    test('excludePinned=true でピン留めページが除外されること', () => {
      const result = sortPages(mockPages, { excludePinned: true });
      expect(result).toHaveLength(2);
      expect(result.find(page => page.title === 'Page A')).toBeUndefined();
    });

    test('excludePinned=false でピン留めページが含まれること', () => {
      const result = sortPages(mockPages, { excludePinned: false });
      expect(result).toHaveLength(3);
      expect(result.find(page => page.title === 'Page A')).toBeDefined();
    });

    test('excludePinned未指定でピン留めページが含まれること', () => {
      const result = sortPages(mockPages);
      expect(result).toHaveLength(3);
      expect(result.find(page => page.title === 'Page A')).toBeDefined();
    });
  });

  describe('デフォルト動作', () => {
    test('ソート方法未指定時はcreated順になること', () => {
      const result = sortPages(mockPages);
      expect(result[0]?.title).toBe('Page B'); // created: 2000
      expect(result[1]?.title).toBe('Page C'); // created: 1500
      expect(result[2]?.title).toBe('Page A'); // created: 1000
    });

    test('空配列を渡しても正常に動作すること', () => {
      const result = sortPages([]);
      expect(result).toEqual([]);
    });
  });

  describe('不正な値の処理', () => {
    test('存在しないソート方法を指定した場合はデフォルト(created)になること', () => {
      const result = sortPages(mockPages, { sort: 'invalid' });
      expect(result[0]?.title).toBe('Page B'); // created: 2000
    });

    test('undefined値が含まれていても正常にソートされること', () => {
      const pagesWithUndefined: ScrapboxPage[] = [
        { title: 'Page 1', created: 1000 },
        { title: 'Page 2' }, // created is undefined
        { title: 'Page 3', created: 2000 },
      ];

      const result = sortPages(pagesWithUndefined, { sort: 'created' });
      expect(result[0]?.title).toBe('Page 3'); // created: 2000
      expect(result[1]?.title).toBe('Page 1'); // created: 1000
      expect(result[2]?.title).toBe('Page 2'); // created: undefined (treated as 0)
    });
  });
});