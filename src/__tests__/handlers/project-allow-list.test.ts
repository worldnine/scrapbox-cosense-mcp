import fs from 'node:fs';
import path from 'node:path';

import { handleCreatePage } from '@/routes/handlers/create-page.js';
import { handleDeleteLines } from '@/routes/handlers/delete-lines.js';
import { handleDeletePage } from '@/routes/handlers/delete-page.js';
import { handleEditLines } from '@/routes/handlers/edit-lines.js';
import { handleGetPage } from '@/routes/handlers/get-page.js';
import { handleGetPageUrl } from '@/routes/handlers/get-page-url.js';
import { handleGetSmartContext } from '@/routes/handlers/get-smart-context.js';
import { handleInsertLines } from '@/routes/handlers/insert-lines.js';
import { handleListPages } from '@/routes/handlers/list-pages.js';
import { handleRewritePage } from '@/routes/handlers/rewrite-page.js';
import { handleSearchPages } from '@/routes/handlers/search-pages.js';

import * as cosense from '@/cosense.js';

jest.mock('@/cosense.js');
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));

const mockedCosense = cosense as jest.Mocked<typeof cosense>;

let mockedPatch: jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
beforeAll(async () => {
  const websocketModule = await import('@cosense/std/websocket');
  mockedPatch = websocketModule.patch as jest.MockedFunction<typeof import('@cosense/std/websocket').patch>;
});

type Handler = (
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: never
) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

/**
 * 全ハンドラの一覧。許可リストの判定は各ハンドラに1行ずつ置いてあるため、
 * ツールを足した人が書き忘れると素通りしてしまう。ここで全ハンドラを列挙し、
 * さらに下のテストで「ファイルはあるのに列挙されていない」を落とす。
 */
const HANDLERS: Array<{
  file: string;
  call: (defaultProjectName: string, projectName?: string) => Promise<unknown>;
}> = [
  {
    file: 'create-page.ts',
    call: (d, p) => (handleCreatePage as Handler)(d, 'sid', { title: 'Page', projectName: p } as never),
  },
  {
    file: 'delete-lines.ts',
    call: (d, p) => (handleDeleteLines as Handler)(d, 'sid', { pageTitle: 'Page', targetLineText: 'line', projectName: p } as never),
  },
  {
    file: 'delete-page.ts',
    call: (d, p) => (handleDeletePage as Handler)(d, 'sid', { pageTitle: 'Page', projectName: p } as never),
  },
  {
    file: 'edit-lines.ts',
    call: (d, p) => (handleEditLines as Handler)(d, 'sid', { pageTitle: 'Page', targetLineText: 'line', newText: 'new', projectName: p } as never),
  },
  {
    file: 'get-page.ts',
    call: (d, p) => (handleGetPage as Handler)(d, 'sid', { pageTitle: 'Page', projectName: p } as never),
  },
  {
    file: 'get-page-url.ts',
    call: (d, p) => (handleGetPageUrl as Handler)(d, 'sid', { title: 'Page', projectName: p } as never),
  },
  {
    file: 'get-smart-context.ts',
    call: (d, p) => (handleGetSmartContext as Handler)(d, 'sid', { title: 'Page', projectName: p } as never),
  },
  {
    file: 'insert-lines.ts',
    call: (d, p) => (handleInsertLines as Handler)(d, 'sid', { pageTitle: 'Page', targetLineText: 'line', text: 'text', projectName: p } as never),
  },
  {
    file: 'list-pages.ts',
    call: (d, p) => (handleListPages as Handler)(d, 'sid', { projectName: p } as never),
  },
  {
    file: 'rewrite-page.ts',
    call: (d, p) => (handleRewritePage as Handler)(d, 'sid', { pageTitle: 'Page', body: 'body', projectName: p } as never),
  },
  {
    file: 'search-pages.ts',
    call: (d, p) => (handleSearchPages as Handler)(d, 'sid', { query: 'q', projectName: p } as never),
  },
];

// src/routes/handlers の実ディレクトリ。テスト実行時のcwdは通常リポジトリルート
function findHandlersDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, 'src', 'routes', 'handlers');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error('src/routes/handlers が見つかりませんでした');
}

function resultText(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
  return content.map(c => c.text ?? '').join('\n');
}

describe('COSENSE_PROJECT_ALLOW_LIST が全ハンドラに効くこと', () => {
  const originalAllowList = process.env.COSENSE_PROJECT_ALLOW_LIST;
  const originalEnableDelete = process.env.COSENSE_ENABLE_DELETE;
  const originalProjectName = process.env.COSENSE_PROJECT_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    // 破壊的ツールが「無効だから」ではなく「許可外だから」落ちることを見たいので有効にしておく
    process.env.COSENSE_ENABLE_DELETE = 'true';
    process.env.COSENSE_PROJECT_NAME = 'default-project';
  });

  afterAll(() => {
    if (originalAllowList === undefined) {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;
    } else {
      process.env.COSENSE_PROJECT_ALLOW_LIST = originalAllowList;
    }
    if (originalEnableDelete === undefined) {
      delete process.env.COSENSE_ENABLE_DELETE;
    } else {
      process.env.COSENSE_ENABLE_DELETE = originalEnableDelete;
    }
    if (originalProjectName === undefined) {
      delete process.env.COSENSE_PROJECT_NAME;
    } else {
      process.env.COSENSE_PROJECT_NAME = originalProjectName;
    }
  });

  test('ハンドラのファイルがすべて列挙されていること', () => {
    const files = fs.readdirSync(findHandlersDir())
      .filter(name => name.endsWith('.ts'))
      .sort();
    const listed = HANDLERS.map(h => h.file).sort();
    // 新しいツールを足したらここが落ちる。許可リストの判定を入れて、このテストに追加すること
    expect(listed).toEqual(files);
  });

  describe.each(HANDLERS)('$file', ({ call }) => {
    test('許可外のプロジェクトを指定するとエラーになること', async () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-project';

      const result = await call('default-project', 'forbidden-project') as { isError?: boolean };

      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain("Project 'forbidden-project' is not allowed");
    });

    test('許可外なら Cosense API を一切呼ばないこと', async () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-project';

      await call('default-project', 'forbidden-project');

      expect(mockedPatch).not.toHaveBeenCalled();
      expect(mockedCosense.getPage).not.toHaveBeenCalled();
      expect(mockedCosense.listPages).not.toHaveBeenCalled();
      expect(mockedCosense.searchPages).not.toHaveBeenCalled();
      expect(mockedCosense.getSmartContext).not.toHaveBeenCalled();
      expect(mockedCosense.createPageUrl).not.toHaveBeenCalled();
    });

    test('CLI の --project 相当（既定プロジェクト名としても渡る）でも弾かれること', async () => {
      // CLI は --project=NAME の値を defaultProjectName としてハンドラに渡し、params.projectName は空になる。
      // 暗黙の既定プロジェクトを引数から取ると、この経路だけ許可リストが素通りする
      process.env.COSENSE_PROJECT_NAME = 'allowed-project';
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-project';

      const result = await call('forbidden-project') as { isError?: boolean };

      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain("Project 'forbidden-project' is not allowed");
    });

    test('許可リストが未設定なら許可リスト由来のエラーは出ないこと', async () => {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;

      const result = await call('default-project', 'any-project');

      expect(resultText(result)).not.toContain('is not allowed');
    });

    test('既定プロジェクトはリストに書かれていなくても弾かれないこと', async () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-project';

      const result = await call('default-project', 'default-project');

      expect(resultText(result)).not.toContain('is not allowed');
    });
  });
});
