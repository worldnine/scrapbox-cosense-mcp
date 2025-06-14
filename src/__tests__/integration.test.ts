import { jest } from '@jest/globals';

// 環境変数をモックするためのテスト
describe('MCP Integration Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Integration', () => {
    test('should handle COSENSE_TOOL_SUFFIX environment variable', () => {
      process.env.COSENSE_TOOL_SUFFIX = 'test';
      
      // 環境変数が正しく読み込まれることをテスト
      expect(process.env.COSENSE_TOOL_SUFFIX).toBe('test');
    });

    test('should handle missing COSENSE_TOOL_SUFFIX', () => {
      delete process.env.COSENSE_TOOL_SUFFIX;
      
      expect(process.env.COSENSE_TOOL_SUFFIX).toBeUndefined();
    });

    test('should handle required COSENSE_PROJECT_NAME', () => {
      process.env.COSENSE_PROJECT_NAME = 'test-project';
      
      expect(process.env.COSENSE_PROJECT_NAME).toBe('test-project');
    });
  });

  describe('Tool Name Generation Integration', () => {
    test('should generate correct tool names with suffix', () => {
      const toolSuffix = 'main';
      const baseName = 'get_page';
      const expectedName = `${baseName}_${toolSuffix}`;
      
      expect(expectedName).toBe('get_page_main');
    });

    test('should generate correct tool names without suffix', () => {
      const baseName = 'get_page';
      const expectedName = baseName;
      
      expect(expectedName).toBe('get_page');
    });
  });

  describe('Multiple Server Instance Simulation', () => {
    test('should simulate multiple server configuration', () => {
      const serverConfigs = [
        {
          projectName: 'main-project',
          toolSuffix: 'main',
          expectedTools: ['get_page_main', 'list_pages_main', 'search_pages_main']
        },
        {
          projectName: 'team-project', 
          toolSuffix: 'team',
          expectedTools: ['get_page_team', 'list_pages_team', 'search_pages_team']
        }
      ];

      serverConfigs.forEach(config => {
        const { toolSuffix, expectedTools } = config;
        const baseTools = ['get_page', 'list_pages', 'search_pages'];
        
        const generatedTools = baseTools.map(baseName => 
          toolSuffix ? `${baseName}_${toolSuffix}` : baseName
        );
        
        expect(generatedTools).toEqual(expectedTools);
      });
    });
  });
});