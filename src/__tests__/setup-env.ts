// テストが開発者の手元の資格情報を拾わないようにする。
// `~/.cosense/settings.json`（`cosense login` の保存先）は HOME から引くので、空のディレクトリに向ける。
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.HOME = mkdtempSync(join(tmpdir(), 'cosense-mcp-test-home-'));
delete process.env.COSENSE_PAT;
