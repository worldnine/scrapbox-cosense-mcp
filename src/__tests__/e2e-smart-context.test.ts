import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const exec = promisify(execFile);
const CLI = resolve(__dirname, '../../build/index.js');

// E2Eテスト: 実際のCosense APIを叩く
// COSENSE_SID と COSENSE_PROJECT_NAME が設定されている場合のみ実行
const hasCreds = process.env.COSENSE_SID && process.env.COSENSE_PROJECT_NAME;

const describeE2E = hasCreds ? describe : describe.skip;

describeE2E('get_smart_context E2E', () => {
  const timeout = 30000;

  async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await exec('node', [CLI, ...args], {
        timeout,
        env: { ...process.env },
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        exitCode: e.code ?? 1,
      };
    }
  }

  describe('CLI 正常系', () => {
    it('1hop でスマートコンテキストを取得できる', async () => {
      const { stdout, exitCode } = await runCli(['context', 'TAO Tips']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('<PageList>');
      expect(stdout).toContain('TAO Tips');
      expect(stdout).toContain('type="mainpage"');
    }, timeout);

    it('2hop でより多くのページを取得できる', async () => {
      const { stdout, exitCode } = await runCli(['context', 'TAO Tips', '--hop=2']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('<PageList>');
      expect(stdout).toContain('type="mainpage"');
      expect(stdout).toContain('type="1hopLink"');
    }, timeout);

    it('compact モードで AI ガイドヘッダーが除去される', async () => {
      const { stdout, exitCode } = await runCli(['context', 'TAO Tips', '--compact']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('<PageList>');
      expect(stdout).not.toMatch(/^This text contains/);
    }, timeout);

    it('1hop より 2hop の方がレスポンスが大きい', async () => {
      const [hop1, hop2] = await Promise.all([
        runCli(['context', 'TAO Tips', '--compact']),
        runCli(['context', 'TAO Tips', '--hop=2', '--compact']),
      ]);

      expect(hop1.exitCode).toBe(0);
      expect(hop2.exitCode).toBe(0);
      expect(hop2.stdout.length).toBeGreaterThan(hop1.stdout.length);
    }, timeout);
  });

  describe('CLI エラー系', () => {
    it('--hop=3 はエラーになる', async () => {
      const { stderr, exitCode } = await runCli(['context', 'TAO Tips', '--hop=3']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--hop must be 1 or 2');
    }, timeout);

    it('--hop=1abc はエラーになる', async () => {
      const { stderr, exitCode } = await runCli(['context', 'TAO Tips', '--hop=1abc']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--hop must be 1 or 2');
    }, timeout);

    it('タイトル未指定はエラーになる', async () => {
      const { stderr, exitCode } = await runCli(['context']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Page title is required');
    }, timeout);
  });

  describe('MCP 正常系', () => {
    async function callMcp(request: string): Promise<string> {
      const { stdout } = await exec(
        'sh',
        ['-c', `echo '${request.replace(/'/g, "'\\''")}' | node ${CLI}`],
        { timeout, env: { ...process.env } },
      );
      return stdout;
    }

    it('tools/list に get_smart_context が含まれる', async () => {
      const stdout = await callMcp('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
      const response = JSON.parse(stdout) as { result: { tools: { name: string }[] } };
      const toolNames = response.result.tools.map(t => t.name);

      expect(toolNames).toContain('get_smart_context');
    }, timeout);

    it('get_smart_context でコンテンツを取得できる', async () => {
      const stdout = await callMcp(
        '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_smart_context","arguments":{"title":"TAO Tips"}}}'
      );
      const response = JSON.parse(stdout) as { result: { content: { text: string }[] } };
      const text = response.result.content[0]?.text ?? '';

      expect(text).toContain('<PageList>');
      expect(text).toContain('TAO Tips');
    }, timeout);

    it('不正な hopCount はエラーを返す', async () => {
      const stdout = await callMcp(
        '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_smart_context","arguments":{"title":"TAO Tips","hopCount":5}}}'
      );
      const response = JSON.parse(stdout) as { result: { content: { text: string }[] } };
      const text = response.result.content[0]?.text ?? '';

      expect(text).toContain('Invalid hopCount');
    }, timeout);
  });
});
