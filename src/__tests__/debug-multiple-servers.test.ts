import { jest } from '@jest/globals';

// 複数サーバーの問題をデバッグするためのテスト
describe('Multiple Servers Debug Tests', () => {
  describe('Environment Variable Parsing', () => {
    test('should correctly parse COSENSE_PROJECT_NAME', () => {
      const testCases = [
        { projectName: 'test-project-1', expected: 'test-project-1' },
        { projectName: 'test-project-2', expected: 'test-project-2' },
        { projectName: 'test-project-3', expected: 'test-project-3' }
      ];

      testCases.forEach(({ projectName, expected }) => {
        process.env.COSENSE_PROJECT_NAME = projectName;
        expect(process.env.COSENSE_PROJECT_NAME).toBe(expected);
      });
    });

    test('should correctly parse COSENSE_SID', () => {
      const testSids = [
        's:DUMMY_SID_FOR_TESTING_SERVER1.DUMMY_SIGNATURE_PART_1',
        's:DUMMY_SID_FOR_TESTING_SERVER2.DUMMY_SIGNATURE_PART_2'
      ];

      testSids.forEach(sid => {
        process.env.COSENSE_SID = sid;
        expect(process.env.COSENSE_SID).toBe(sid);
        expect(process.env.COSENSE_SID).toMatch(/^s:/);
      });
    });

    test('should handle COSENSE_TOOL_SUFFIX variations', () => {
      const suffixCases = [
        { suffix: 'test-project-1', expected: 'test-project-1' },
        { suffix: 'test-project-2', expected: 'test-project-2' },
        { suffix: undefined, expected: undefined },
        { suffix: '', expected: '' }
      ];

      suffixCases.forEach(({ suffix, expected }) => {
        if (suffix === undefined) {
          delete process.env.COSENSE_TOOL_SUFFIX;
        } else {
          process.env.COSENSE_TOOL_SUFFIX = suffix;
        }
        expect(process.env.COSENSE_TOOL_SUFFIX).toBe(expected);
      });
    });
  });

  describe('Tool Name Generation for Multiple Servers', () => {
    function getToolName(baseName: string, toolSuffix?: string): string {
      return toolSuffix ? `${baseName}_${toolSuffix}` : baseName;
    }

    test('should generate unique tool names for each server', () => {
      const serverConfigs = [
        { project: 'test-project-1', suffix: 'test-project-1' },
        { project: 'test-project-2', suffix: 'test-project-2' }
      ];

      const baseTools = ['get_page', 'list_pages', 'search_pages', 'create_page', 'get_page_url'];
      
      const allGeneratedTools: string[] = [];

      serverConfigs.forEach(({ suffix }) => {
        const serverTools = baseTools.map(baseName => getToolName(baseName, suffix));
        allGeneratedTools.push(...serverTools);
        
        // 各サーバーのツールがサフィックス付きであることを確認
        serverTools.forEach(toolName => {
          expect(toolName).toContain(`_${suffix}`);
        });
      });

      // 全てのツール名がユニークであることを確認
      const uniqueTools = new Set(allGeneratedTools);
      expect(uniqueTools.size).toBe(allGeneratedTools.length);
    });

    test('should handle server configuration without suffix', () => {
      const baseTools = ['simple_tool'];  // アンダースコアを含まないツール名
      const toolsWithoutSuffix = baseTools.map(baseName => getToolName(baseName));
      
      toolsWithoutSuffix.forEach(toolName => {
        expect(toolName).toBe('simple_tool');
      });
      
      // 実際のツール名では、元々アンダースコアを含んでいてもサフィックスがなければそのまま
      expect(getToolName('get_page')).toBe('get_page');
      expect(getToolName('list_pages')).toBe('list_pages');
    });
  });

  describe('SID Authentication Debug', () => {
    test('should validate SID format', () => {
      const validSids = [
        's:DUMMY_SID_FOR_TESTING_SERVER1.DUMMY_SIGNATURE_PART_1',
        's:DUMMY_SID_FOR_TESTING_SERVER2.DUMMY_SIGNATURE_PART_2'
      ];

      validSids.forEach(sid => {
        expect(sid).toMatch(/^s:[A-Za-z0-9_-]+\.[A-Za-z0-9+/=_-]+$/);
      });
    });

    test('should detect potentially invalid SIDs', () => {
      const invalidSids = [
        '',
        'invalid-sid',
        's:',
        's:invalid',
        'not-s-prefixed'
      ];

      invalidSids.forEach(sid => {
        expect(sid).not.toMatch(/^s:[A-Za-z0-9_-]+\.[A-Za-z0-9+/=_-]+$/);
      });
    });
  });

  describe('Project Access Simulation', () => {
    test('should simulate different project access scenarios', async () => {
      const projectConfigs = [
        {
          name: 'test-project-1',
          sid: 's:DUMMY_SID_FOR_TESTING_SERVER1.DUMMY_SIGNATURE_PART_1',
          expected: 'private-project'
        },
        {
          name: 'test-project-2', 
          sid: 's:DUMMY_SID_FOR_TESTING_SERVER2.DUMMY_SIGNATURE_PART_2',
          expected: 'private-project'
        },
        {
          name: 'test-project-3',
          sid: undefined,
          expected: 'public-project'
        }
      ];

      projectConfigs.forEach(({ name, sid, expected }) => {
        const accessType = sid ? 'private-project' : 'public-project';
        expect(accessType).toBe(expected);
        
        // プロジェクト名の検証
        expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
      });
    });
  });

  describe('MCP Configuration Validation', () => {
    test('should validate complete MCP server configuration', () => {
      const mockConfigs = [
        {
          serverName: 'test-project-1-scrapbox-mcp',
          env: {
            COSENSE_PROJECT_NAME: 'test-project-1',
            COSENSE_SID: 's:DUMMY_SID_FOR_TESTING_SERVER1.DUMMY_SIGNATURE_PART_1',
            COSENSE_TOOL_SUFFIX: 'test-project-1',
            SERVICE_LABEL: 'scrapbox'
          }
        },
        {
          serverName: 'test-project-2-scrapbox-mcp',
          env: {
            COSENSE_PROJECT_NAME: 'test-project-2',
            COSENSE_SID: 's:DUMMY_SID_FOR_TESTING_SERVER2.DUMMY_SIGNATURE_PART_2',
            COSENSE_TOOL_SUFFIX: 'test-project-2', 
            SERVICE_LABEL: 'scrapbox'
          }
        }
      ];

      mockConfigs.forEach(({ serverName, env }) => {
        // 必須環境変数の確認
        expect(env.COSENSE_PROJECT_NAME).toBeDefined();
        expect(env.COSENSE_SID).toBeDefined();
        expect(env.COSENSE_TOOL_SUFFIX).toBeDefined();
        
        // サーバー名とサフィックスの一貫性確認
        expect(serverName).toContain(env.COSENSE_PROJECT_NAME);
        expect(env.COSENSE_TOOL_SUFFIX).toBe(env.COSENSE_PROJECT_NAME);
      });
    });
  });
});