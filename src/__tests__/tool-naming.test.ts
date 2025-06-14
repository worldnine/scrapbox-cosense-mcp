import { jest } from '@jest/globals';

// テスト用のモジュールを作成
function getToolName(baseName: string, toolSuffix?: string): string {
  return toolSuffix ? `${baseName}_${toolSuffix}` : baseName;
}

function normalizeToolName(toolName: string, toolSuffix?: string): string {
  if (!toolSuffix) return toolName;
  
  const suffix = `_${toolSuffix}`;
  return toolName.endsWith(suffix) ? toolName.slice(0, -suffix.length) : toolName;
}

describe('Tool Naming Functions', () => {
  describe('getToolName', () => {
    test('should return base name when no suffix provided', () => {
      expect(getToolName('get_page')).toBe('get_page');
      expect(getToolName('list_pages')).toBe('list_pages');
    });

    test('should return base name when suffix is undefined', () => {
      expect(getToolName('get_page', undefined)).toBe('get_page');
      expect(getToolName('list_pages', undefined)).toBe('list_pages');
    });

    test('should append suffix when provided', () => {
      expect(getToolName('get_page', 'main')).toBe('get_page_main');
      expect(getToolName('list_pages', 'team')).toBe('list_pages_team');
      expect(getToolName('search_pages', 'villagepump')).toBe('search_pages_villagepump');
    });

    test('should handle empty suffix', () => {
      expect(getToolName('get_page', '')).toBe('get_page');
    });
  });

  describe('normalizeToolName', () => {
    test('should return original name when no suffix provided', () => {
      expect(normalizeToolName('get_page')).toBe('get_page');
      expect(normalizeToolName('get_page_main')).toBe('get_page_main');
    });

    test('should return original name when suffix is undefined', () => {
      expect(normalizeToolName('get_page', undefined)).toBe('get_page');
      expect(normalizeToolName('get_page_main', undefined)).toBe('get_page_main');
    });

    test('should remove suffix when it matches', () => {
      expect(normalizeToolName('get_page_main', 'main')).toBe('get_page');
      expect(normalizeToolName('list_pages_team', 'team')).toBe('list_pages');
      expect(normalizeToolName('search_pages_villagepump', 'villagepump')).toBe('search_pages');
    });

    test('should return original name when suffix does not match', () => {
      expect(normalizeToolName('get_page_main', 'team')).toBe('get_page_main');
      expect(normalizeToolName('list_pages', 'main')).toBe('list_pages');
    });

    test('should handle empty suffix', () => {
      expect(normalizeToolName('get_page_main', '')).toBe('get_page_main');
    });

    test('should handle complex tool names', () => {
      expect(normalizeToolName('create_page_my_project', 'my_project')).toBe('create_page');
      expect(normalizeToolName('get_page_url_test123', 'test123')).toBe('get_page_url');
    });
  });

  describe('round-trip compatibility', () => {
    test('should maintain round-trip compatibility', () => {
      const testCases = [
        { baseName: 'get_page', suffix: 'main' },
        { baseName: 'list_pages', suffix: 'team' },
        { baseName: 'search_pages', suffix: 'villagepump' },
        { baseName: 'create_page', suffix: 'my_project' },
        { baseName: 'get_page_url', suffix: 'test123' }
      ];

      testCases.forEach(({ baseName, suffix }) => {
        const toolName = getToolName(baseName, suffix);
        const normalized = normalizeToolName(toolName, suffix);
        expect(normalized).toBe(baseName);
      });
    });
  });
});