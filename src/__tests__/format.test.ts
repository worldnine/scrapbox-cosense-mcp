import { formatYmd, getSortDescription, getSortValue, formatPageOutput } from '@/utils/format.js';
import type { BasePage } from '@/utils/format.js';

describe('format utilities', () => {
  describe('formatYmd', () => {
    test('日付を正しくフォーマットすること', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      expect(formatYmd(date)).toBe('2023/12/25');
    });

    test('月日が1桁の場合でも正しくフォーマットすること', () => {
      const date = new Date('2023-01-05T10:30:00Z');
      expect(formatYmd(date)).toBe('2023/1/5');
    });
  });

  describe('getSortDescription', () => {
    test('各ソート方法の説明を正しく返すこと', () => {
      expect(getSortDescription('updated')).toBe('Sorted by last updated');
      expect(getSortDescription('created')).toBe('Sorted by creation date');
      expect(getSortDescription('accessed')).toBe('Sorted by last accessed');
      expect(getSortDescription('linked')).toBe('Sorted by number of incoming links');
      expect(getSortDescription('views')).toBe('Sorted by view count');
      expect(getSortDescription('title')).toBe('Sorted by title');
    });

    test('未知のソート方法にはデフォルト説明を返すこと', () => {
      expect(getSortDescription('unknown')).toBe('Default order');
      expect(getSortDescription(undefined)).toBe('Default order');
    });
  });

  describe('getSortValue', () => {
    const mockPage: BasePage = {
      title: 'Test Page',
      created: 1700000000,
      updated: 1700001000,
      accessed: 1700002000,
      linked: 5,
      views: 100,
    };

    test('updated の値を正しく取得すること', () => {
      const result = getSortValue(mockPage, 'updated');
      expect(result.value).toBe(1700001000);
      // Timestamp 1700001000 converts to 2023/11/14 in UTC, 2023/11/15 in JST
      expect(result.formatted).toMatch(/2023\/11\/(14|15)/);
    });

    test('created の値を正しく取得すること', () => {
      const result = getSortValue(mockPage, 'created');
      expect(result.value).toBe(1700000000);
      // Timestamp 1700000000 converts to 2023/11/14 in UTC, 2023/11/15 in JST
      expect(result.formatted).toMatch(/2023\/11\/(14|15)/);
    });

    test('linked の値を正しく取得すること', () => {
      const result = getSortValue(mockPage, 'linked');
      expect(result.value).toBe(5);
      expect(result.formatted).toBe('5');
    });

    test('views の値を正しく取得すること', () => {
      const result = getSortValue(mockPage, 'views');
      expect(result.value).toBe(100);
      expect(result.formatted).toBe('100');
    });

    test('title の値を正しく取得すること', () => {
      const result = getSortValue(mockPage, 'title');
      expect(result.value).toBe('Test Page');
      expect(result.formatted).toBe('Test Page');
    });

    test('undefined値を適切に処理すること', () => {
      const pageWithoutValues: BasePage = {
        title: 'Empty Page',
      };

      const updatedResult = getSortValue(pageWithoutValues, 'updated');
      expect(updatedResult.value).toBe(0);
      expect(updatedResult.formatted).toBe('Not available');

      const linkedResult = getSortValue(pageWithoutValues, 'linked');
      expect(linkedResult.value).toBe(0);
      expect(linkedResult.formatted).toBe('0');
    });

    test('不明なソート方法には適切なデフォルト値を返すこと', () => {
      const result = getSortValue(mockPage, 'unknown');
      expect(result.value).toBeNull();
      expect(result.formatted).toBe('Not specified');
    });
  });

  describe('formatPageOutput', () => {
    const mockExtendedPage = {
      title: 'Test Page',
      created: 1700000000,
      updated: 1700001000,
      pin: 0,
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

    test('基本的なページ情報をフォーマットすること', () => {
      const result = formatPageOutput(mockExtendedPage, 0);
      
      expect(result).toContain('Page number: 1');
      expect(result).toContain('Title: Test Page');
      expect(result).toContain('Pinned: No');
      expect(result).toContain('Created user: Test User');
      expect(result).toContain('Last editor: Update User');
      expect(result).toContain('Other editors: Collab User');
    });

    test('skipオプションを正しく適用すること', () => {
      const result = formatPageOutput(mockExtendedPage, 2, { skip: 10 });
      expect(result).toContain('Page number: 13'); // 10 + 2 + 1
    });

    test('ソート値表示オプションを正しく適用すること', () => {
      const result = formatPageOutput(mockExtendedPage, 0, { 
        showSort: true, 
        sortValue: '2023/11/15' 
      });
      expect(result).toContain('Sort value: 2023/11/15');
    });

    test('検索結果表示オプションを正しく適用すること', () => {
      const pageWithWords = {
        ...mockExtendedPage,
        words: ['test', 'keyword'],
      };

      const result = formatPageOutput(pageWithWords, 0, { 
        showMatches: true 
      });
      expect(result).toContain('Matched words: test, keyword');
    });

    test('スニペット表示オプションを正しく適用すること', () => {
      const pageWithLines = {
        ...mockExtendedPage,
        lines: ['Line 1', 'Line 2', 'Line 3'],
      };

      const result = formatPageOutput(pageWithLines, 0, { 
        showSnippet: true 
      });
      expect(result).toContain('Snippet:');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });

    test('説明表示オプションを正しく適用すること', () => {
      const pageWithDescriptions = {
        ...mockExtendedPage,
        descriptions: ['Description line 1', 'Description line 2'],
      };

      const result = formatPageOutput(pageWithDescriptions, 0, { 
        showDescriptions: true 
      });
      expect(result).toContain('Description:');
      expect(result).toContain('Description line 1');
      expect(result).toContain('Description line 2');
    });

    test('検索結果モードでは日付を非表示にすること', () => {
      const result = formatPageOutput(mockExtendedPage, 0, { 
        isSearchResult: true 
      });
      expect(result).not.toContain('Created:');
      expect(result).not.toContain('Updated:');
    });
  });
});