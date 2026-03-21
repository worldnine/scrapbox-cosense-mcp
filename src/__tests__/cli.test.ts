// Mock external dependencies before handler imports
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));
jest.mock('@/cosense.js');
jest.mock('@/utils/markdown-converter.js', () => ({
  convertMarkdownToScrapbox: jest.fn((text: string) => text)
}));

import * as getPageHandler from '@/routes/handlers/get-page.js';
import * as listPagesHandler from '@/routes/handlers/list-pages.js';
import * as searchPagesHandler from '@/routes/handlers/search-pages.js';
import * as createPageHandler from '@/routes/handlers/create-page.js';
import * as getPageUrlHandler from '@/routes/handlers/get-page-url.js';
import * as insertLinesHandler from '@/routes/handlers/insert-lines.js';

jest.mock('@/routes/handlers/get-page.js');
jest.mock('@/routes/handlers/list-pages.js');
jest.mock('@/routes/handlers/search-pages.js');
jest.mock('@/routes/handlers/create-page.js');
jest.mock('@/routes/handlers/get-page-url.js');
jest.mock('@/routes/handlers/insert-lines.js');

const mockedGetPage = getPageHandler as jest.Mocked<typeof getPageHandler>;
const mockedListPages = listPagesHandler as jest.Mocked<typeof listPagesHandler>;
const mockedSearchPages = searchPagesHandler as jest.Mocked<typeof searchPagesHandler>;
const mockedCreatePage = createPageHandler as jest.Mocked<typeof createPageHandler>;
const mockedGetPageUrl = getPageUrlHandler as jest.Mocked<typeof getPageUrlHandler>;
const mockedInsertLines = insertLinesHandler as jest.Mocked<typeof insertLinesHandler>;

// Mock process.exit to prevent test process from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

// Capture stdout/stderr
let stdoutOutput: string;
let stderrOutput: string;
const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
  stdoutOutput += String(chunk);
  return true;
});
const mockStderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
  stderrOutput += String(chunk);
  return true;
});

// Import after mocks
import { runCli } from '@/cli.js';

const successResult = {
  content: [{ type: 'text', text: 'Success output' }],
};
const errorResult = {
  content: [{ type: 'text', text: 'Error output' }],
  isError: true,
};

describe('CLI', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    stdoutOutput = '';
    stderrOutput = '';
    mockExit.mockClear();
    mockStdoutWrite.mockClear();
    mockStderrWrite.mockClear();
    process.env = { ...originalEnv, COSENSE_PROJECT_NAME: 'test-project', COSENSE_SID: 'test-sid' };
  });

  afterAll(() => {
    process.env = originalEnv;
    mockExit.mockRestore();
    mockStdoutWrite.mockRestore();
    mockStderrWrite.mockRestore();
  });

  describe('help', () => {
    it('should print help with --help flag', async () => {
      try {
        await runCli(['--help']);
      } catch {
        // process.exit throws
      }
      expect(stdoutOutput).toContain('scrapbox-cosense-mcp');
      expect(stdoutOutput).toContain('Commands:');
    });

    it('should print help with unknown command', async () => {
      try {
        await runCli(['unknown-command']);
      } catch {
        // process.exit throws
      }
      expect(stdoutOutput).toContain('Commands:');
    });
  });

  describe('get command', () => {
    it('should call handleGetPage with correct params', async () => {
      mockedGetPage.handleGetPage.mockResolvedValue(successResult);
      try {
        await runCli(['get', 'My Page']);
      } catch {
        // process.exit
      }
      expect(mockedGetPage.handleGetPage).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        { pageTitle: 'My Page', projectName: undefined }
      );
      expect(stdoutOutput).toContain('Success output');
    });

    it('should error when title is missing', async () => {
      try {
        await runCli(['get']);
      } catch {
        // process.exit
      }
      expect(stderrOutput).toContain('Page title is required');
    });

    it('should support --project flag', async () => {
      mockedGetPage.handleGetPage.mockResolvedValue(successResult);
      try {
        await runCli(['get', 'My Page', '--project=other-project']);
      } catch {
        // process.exit
      }
      expect(mockedGetPage.handleGetPage).toHaveBeenCalledWith(
        'other-project',
        'test-sid',
        { pageTitle: 'My Page', projectName: 'other-project' }
      );
    });
  });

  describe('list command', () => {
    it('should call handleListPages with default params', async () => {
      mockedListPages.handleListPages.mockResolvedValue(successResult);
      try {
        await runCli(['list']);
      } catch {
        // process.exit
      }
      expect(mockedListPages.handleListPages).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        { sort: undefined, limit: undefined, skip: undefined, excludePinned: false, projectName: undefined }
      );
    });

    it('should pass sort, limit, skip options', async () => {
      mockedListPages.handleListPages.mockResolvedValue(successResult);
      try {
        await runCli(['list', '--sort=created', '--limit=20', '--skip=5', '--exclude-pinned']);
      } catch {
        // process.exit
      }
      expect(mockedListPages.handleListPages).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        { sort: 'created', limit: 20, skip: 5, excludePinned: true, projectName: undefined }
      );
    });
  });

  describe('search command', () => {
    it('should call handleSearchPages with query', async () => {
      mockedSearchPages.handleSearchPages.mockResolvedValue(successResult);
      try {
        await runCli(['search', 'test keyword']);
      } catch {
        // process.exit
      }
      expect(mockedSearchPages.handleSearchPages).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        { query: 'test keyword', projectName: undefined }
      );
    });

    it('should error when query is missing', async () => {
      try {
        await runCli(['search']);
      } catch {
        // process.exit
      }
      expect(stderrOutput).toContain('Search query is required');
    });
  });

  describe('create command', () => {
    it('should call handleCreatePage with title and body', async () => {
      mockedCreatePage.handleCreatePage.mockResolvedValue(successResult);
      try {
        await runCli(['create', 'New Page', '--body=Hello world']);
      } catch {
        // process.exit
      }
      expect(mockedCreatePage.handleCreatePage).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        { title: 'New Page', body: 'Hello world', createActually: true, format: undefined, projectName: undefined }
      );
    });

    it('should support --dry-run flag', async () => {
      mockedCreatePage.handleCreatePage.mockResolvedValue(successResult);
      try {
        await runCli(['create', 'New Page', '--dry-run']);
      } catch {
        // process.exit
      }
      expect(mockedCreatePage.handleCreatePage).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        expect.objectContaining({ createActually: false })
      );
    });

    it('should support --format=scrapbox', async () => {
      mockedCreatePage.handleCreatePage.mockResolvedValue(successResult);
      try {
        await runCli(['create', 'New Page', '--body=content', '--format=scrapbox']);
      } catch {
        // process.exit
      }
      expect(mockedCreatePage.handleCreatePage).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        expect.objectContaining({ format: 'scrapbox' })
      );
    });
  });

  describe('url command', () => {
    it('should call handleGetPageUrl with title', async () => {
      mockedGetPageUrl.handleGetPageUrl.mockResolvedValue(successResult);
      try {
        await runCli(['url', 'My Page']);
      } catch {
        // process.exit
      }
      expect(mockedGetPageUrl.handleGetPageUrl).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        { title: 'My Page', projectName: undefined }
      );
    });
  });

  describe('insert command', () => {
    it('should call handleInsertLines with all params', async () => {
      mockedInsertLines.handleInsertLines.mockResolvedValue(successResult);
      try {
        await runCli(['insert', 'My Page', '--after=target line', '--text=new content']);
      } catch {
        // process.exit
      }
      expect(mockedInsertLines.handleInsertLines).toHaveBeenCalledWith(
        'test-project',
        'test-sid',
        {
          pageTitle: 'My Page',
          targetLineText: 'target line',
          text: 'new content',
          format: undefined,
          projectName: undefined,
        }
      );
    });

    it('should error when --after is missing', async () => {
      try {
        await runCli(['insert', 'My Page', '--text=content']);
      } catch {
        // process.exit
      }
      expect(stderrOutput).toContain('--after=TEXT is required');
    });

    it('should error when --text is missing', async () => {
      try {
        await runCli(['insert', 'My Page', '--after=line']);
      } catch {
        // process.exit
      }
      expect(stderrOutput).toContain('--text=TEXT or --text-file=PATH is required');
    });
  });

  describe('output formatting', () => {
    it('should output JSON when --json flag is set', async () => {
      mockedGetPage.handleGetPage.mockResolvedValue(successResult);
      try {
        await runCli(['get', 'My Page', '--json']);
      } catch {
        // process.exit
      }
      const parsed = JSON.parse(stdoutOutput);
      expect(parsed).toEqual(successResult);
    });

    it('should output error to stderr', async () => {
      mockedGetPage.handleGetPage.mockResolvedValue(errorResult);
      try {
        await runCli(['get', 'Missing Page']);
      } catch {
        // process.exit
      }
      expect(stderrOutput).toContain('Error output');
    });

    it('should exit with code 1 on handler error', async () => {
      mockedGetPage.handleGetPage.mockResolvedValue(errorResult);
      try {
        await runCli(['get', 'Missing Page']);
      } catch {
        // expected
      }
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with code 0 on success', async () => {
      mockedGetPage.handleGetPage.mockResolvedValue(successResult);
      try {
        await runCli(['get', 'My Page']);
      } catch {
        // expected
      }
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('environment variable handling', () => {
    it('should error when COSENSE_PROJECT_NAME is not set', async () => {
      delete process.env.COSENSE_PROJECT_NAME;
      try {
        await runCli(['get', 'My Page']);
      } catch {
        // process.exit
      }
      expect(stderrOutput).toContain('COSENSE_PROJECT_NAME is not set');
    });

    it('should use --project over COSENSE_PROJECT_NAME', async () => {
      mockedGetPageUrl.handleGetPageUrl.mockResolvedValue(successResult);
      try {
        await runCli(['url', 'My Page', '--project=override-project']);
      } catch {
        // process.exit
      }
      expect(mockedGetPageUrl.handleGetPageUrl).toHaveBeenCalledWith(
        'override-project',
        'test-sid',
        { title: 'My Page', projectName: 'override-project' }
      );
    });
  });
});
