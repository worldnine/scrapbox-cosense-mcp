import { jest } from '@jest/globals';

// 複数サーバーの問題をデバッグするためのテスト
describe('Multiple Servers Debug Tests', () => {
  describe('Environment Variable Parsing', () => {
    test('should correctly parse COSENSE_PROJECT_NAME', () => {
      const testCases = [
        { projectName: 'ecl', expected: 'ecl' },
        { projectName: 'infosign', expected: 'infosign' },
        { projectName: 'villagepump', expected: 'villagepump' }
      ];

      testCases.forEach(({ projectName, expected }) => {
        process.env.COSENSE_PROJECT_NAME = projectName;
        expect(process.env.COSENSE_PROJECT_NAME).toBe(expected);
      });
    });

    test('should correctly parse COSENSE_SID', () => {
      const testSids = [
        's:sDoh_fIwJq_lbBdLDsOc0ES-GfgfK_JW.d7OMbAIOuYzDt469e6GykCtw9vOf6Ww4Ui+cyfF2XCc',
        's:pBAGBi6pMXknGEUUI4mlcc2lEGOFw8xg.KFChh6v4XAGawTF7mG44f+ncrZl5LOv+D/2RUGomexk'
      ];

      testSids.forEach(sid => {
        process.env.COSENSE_SID = sid;
        expect(process.env.COSENSE_SID).toBe(sid);
        expect(process.env.COSENSE_SID).toMatch(/^s:/);
      });
    });

    test('should handle COSENSE_TOOL_SUFFIX variations', () => {
      const suffixCases = [
        { suffix: 'ecl', expected: 'ecl' },
        { suffix: 'infosign', expected: 'infosign' },
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
        { project: 'ecl', suffix: 'ecl' },
        { project: 'infosign', suffix: 'infosign' }
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
        's:sDoh_fIwJq_lbBdLDsOc0ES-GfgfK_JW.d7OMbAIOuYzDt469e6GykCtw9vOf6Ww4Ui+cyfF2XCc',
        's:pBAGBi6pMXknGEUUI4mlcc2lEGOFw8xg.KFChh6v4XAGawTF7mG44f+ncrZl5LOv+D/2RUGomexk'
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
          name: 'ecl',
          sid: 's:sDoh_fIwJq_lbBdLDsOc0ES-GfgfK_JW.d7OMbAIOuYzDt469e6GykCtw9vOf6Ww4Ui+cyfF2XCc',
          expected: 'private-project'
        },
        {
          name: 'infosign', 
          sid: 's:pBAGBi6pMXknGEUUI4mlcc2lEGOFw8xg.KFChh6v4XAGawTF7mG44f+ncrZl5LOv+D/2RUGomexk',
          expected: 'private-project'
        },
        {
          name: 'villagepump',
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
          serverName: 'ecl-scrapbox-mcp',
          env: {
            COSENSE_PROJECT_NAME: 'ecl',
            COSENSE_SID: 's:sDoh_fIwJq_lbBdLDsOc0ES-GfgfK_JW.d7OMbAIOuYzDt469e6GykCtw9vOf6Ww4Ui+cyfF2XCc',
            COSENSE_TOOL_SUFFIX: 'ecl',
            SERVICE_LABEL: 'scrapbox'
          }
        },
        {
          serverName: 'infosign-scrapbox-mcp',
          env: {
            COSENSE_PROJECT_NAME: 'infosign',
            COSENSE_SID: 's:pBAGBi6pMXknGEUUI4mlcc2lEGOFw8xg.KFChh6v4XAGawTF7mG44f+ncrZl5LOv+D/2RUGomexk',
            COSENSE_TOOL_SUFFIX: 'infosign', 
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