// ハンドラはモックしない。CLI がプロジェクト名をどう渡すかまで含めて確認したいため
jest.mock('@cosense/std/websocket', () => ({
  patch: jest.fn()
}));
jest.mock('@/cosense.js');

import { runCli } from '@/cli.js';

const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

let stdoutOutput: string;
let stderrOutput: string;
jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
  stdoutOutput += String(chunk);
  return true;
});
jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
  stderrOutput += String(chunk);
  return true;
});

async function run(argv: string[]): Promise<void> {
  try {
    await runCli(argv);
  } catch (error) {
    // process.exit のモックが投げる例外だけを飲み込む
    if (!(error instanceof Error) || error.message !== 'process.exit called') throw error;
  }
}

/**
 * CLI は `--project=NAME` の値をハンドラの第1引数（既定プロジェクト名）としても渡す。
 * 許可リストの暗黙の既定プロジェクトを引数から取ると、この経路だけ判定が素通りになる。
 */
describe('CLI での COSENSE_PROJECT_ALLOW_LIST', () => {
  const originalAllowList = process.env.COSENSE_PROJECT_ALLOW_LIST;
  const originalProjectName = process.env.COSENSE_PROJECT_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    stdoutOutput = '';
    stderrOutput = '';
    process.env.COSENSE_PROJECT_NAME = 'allowed-default';
    process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-default';
  });

  afterAll(() => {
    if (originalAllowList === undefined) {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;
    } else {
      process.env.COSENSE_PROJECT_ALLOW_LIST = originalAllowList;
    }
    if (originalProjectName === undefined) {
      delete process.env.COSENSE_PROJECT_NAME;
    } else {
      process.env.COSENSE_PROJECT_NAME = originalProjectName;
    }
    jest.restoreAllMocks();
  });

  test('--project で許可外のプロジェクトを指定するとエラー終了すること', async () => {
    await run(['url', 'TestPage', '--project=forbidden-project']);

    expect(stderrOutput).toContain("Project 'forbidden-project' is not allowed");
    expect(stdoutOutput).not.toContain('forbidden-project');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('読み取り系サブコマンドでも弾かれること', async () => {
    await run(['get', 'TestPage', '--project=forbidden-project']);

    expect(stderrOutput).toContain("Project 'forbidden-project' is not allowed");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('--project で許可済みのプロジェクトを指定すれば通ること', async () => {
    process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-default,other-project';

    await run(['url', 'TestPage', '--project=other-project']);

    expect(stderrOutput).not.toContain('is not allowed');
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test('許可リストが未設定なら --project は従来どおり自由に指定できること', async () => {
    delete process.env.COSENSE_PROJECT_ALLOW_LIST;

    await run(['url', 'TestPage', '--project=any-project']);

    expect(stderrOutput).not.toContain('is not allowed');
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
