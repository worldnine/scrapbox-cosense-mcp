import { randomBytes } from 'node:crypto';
import { fetch } from '@whatwg-node/fetch';
import { patch } from '@cosense/std/websocket';
import type { BaseLine } from '@cosense/types/rest';
import { credentialHeaders, getApiDomain, resolveCredential, type Credential } from './utils/auth.js';
import { stringifyError } from './utils/format.js';

/**
 * ページの今の行から、書き込み後の行を作る関数。`@cosense/std` の `patch` と同じ約束で、
 * 受け取った配列をそのまま返すと何も書かず、空配列を返すとページを消す。
 * 衝突で読み直すと何度か呼ばれるので、呼び出し側は呼ばれるたびに状態を作り直すこと。
 */
export type PageUpdate = (lines: BaseLine[]) => Array<string | { text: string }>;

export type WriteResult = { ok: true } | { ok: false; err: string };

/** 編集 API（`page-edit-for-ai`）の変更1件 */
export type EditChange =
  | { _insert: string; lines: { id: string; text: string } }
  | { _update: string; lines: { text: string } }
  | { _delete: string }
  | { deleted: true };

/**
 * ページを書き換える。
 *
 * PAT と Service Account は編集 API を、SID は websocket（`patch`）を通す。
 * 編集 API は cookie 認証の書き込みを CSRF 対策で拒否し（`CrossOriginWriteNotAllowedError`）、
 * websocket は cookie 認証しか通らないため、資格情報の種類で経路が決まる。
 */
export async function writePage(
  projectName: string,
  title: string,
  update: PageUpdate,
  sid?: string,
): Promise<WriteResult> {
  const credential = resolveCredential(sid);
  if (!credential) {
    return { ok: false, err: 'Authentication required: COSENSE_PAT or COSENSE_SID is needed for page editing' };
  }
  if (credential.type === 'sid') {
    const result = await patch(projectName, title, update, { sid: credential.value });
    // エラーの文言は websocket だけだったころと同じにする（SID で使っている人から見て何も変えない）
    return result.ok ? { ok: true } : { ok: false, err: `WebSocket patch failed: ${stringifyError(result.err)}` };
  }
  return writeViaEditApi(projectName, title, update, credential);
}

// 読んでから書くまでに他の人がページを変えると 409 NotFastForward が返る。読み直してやり直す回数
const MAX_ATTEMPTS = 3;

async function writeViaEditApi(
  projectName: string,
  title: string,
  update: PageUpdate,
  credential: Credential,
): Promise<WriteResult> {
  const base = `https://${getApiDomain()}/api/pages/v2/${projectName}`;
  const headers = credentialHeaders(credential);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const pageResponse = await fetch(`${base}/${encodeURIComponent(title)}`, { headers });
    if (!pageResponse.ok) {
      return { ok: false, err: `Failed to read the page: HTTP ${pageResponse.status}` };
    }
    const page = await pageResponse.json() as { id: string; persistent?: boolean; lines: BaseLine[] };

    const next = update(page.lines);
    if (next === page.lines) return { ok: true };
    // patch と同じく、1要素に改行が入っていれば複数行として扱う
    const texts = next.flatMap(line => (typeof line === 'string' ? line : line.text).split('\n'));

    const body = buildEditBody(page, texts);
    if (!body) return { ok: true };

    const preview = await postEdit(`${base}/page-edit-for-ai/preview`, headers, body);
    if (preview.kind === 'conflict') continue;
    if (preview.kind === 'error') return { ok: false, err: preview.err };
    const previewId = preview.data.previewId;
    if (typeof previewId !== 'string') {
      return { ok: false, err: 'The preview response had no previewId' };
    }

    const submit = await postEdit(`${base}/page-edit-for-ai/submit`, headers, { previewId });
    if (submit.kind === 'conflict') continue;
    if (submit.kind === 'error') return { ok: false, err: submit.err };
    return { ok: true };
  }
  return { ok: false, err: `The page kept changing while it was being written (NotFastForward, ${MAX_ATTEMPTS} attempts)` };
}

/**
 * 編集 API に送る本文。送るものが無ければ null。
 *
 * - まだ無いページ（`persistent` でない）は `pageId` を付けずに全行を挿入する。編集 API は
 *   これを新規作成として扱い、1行目がタイトルになる
 * - 空配列はページの削除（`{ deleted: true }`）。`patch` と同じ約束
 * - それ以外は今の行との差分
 */
function buildEditBody(
  page: { id: string; persistent?: boolean; lines: BaseLine[] },
  texts: string[],
): { pageId?: string; changes: EditChange[] } | null {
  if (page.persistent !== true) {
    if (texts.length === 0) return null;
    return { changes: texts.map(text => ({ _insert: '_end', lines: { id: newLineId(), text } })) };
  }
  if (texts.length === 0) {
    return { pageId: page.id, changes: [{ deleted: true }] };
  }
  const changes = diffToEditChanges(page.lines, texts);
  return changes.length > 0 ? { pageId: page.id, changes } : null;
}

type PostResult =
  | { kind: 'ok'; data: Record<string, unknown> }
  | { kind: 'conflict' }
  | { kind: 'error'; err: string };

async function postEdit(url: string, headers: Record<string, string>, body: unknown): Promise<PostResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // 本文が JSON でなければ、エラーの説明に生の本文を使う
  }
  if (response.ok) return { kind: 'ok', data };
  if (response.status === 409 && data.error === 'NotFastForward') return { kind: 'conflict' };
  const reason = typeof data.error === 'string' ? data.error : text.slice(0, 200);
  return { kind: 'error', err: `Edit API returned HTTP ${response.status}: ${reason}` };
}

/** 挿入する行の ID。公式 CLI と同じく 12 バイトの乱数を 16 進にする。編集 API はクライアントが決めた ID を受け付ける */
function newLineId(): string {
  return randomBytes(12).toString('hex');
}

// LCS の表に使ってよいマス目の数。超えたら中ほどを先頭から順に対にする（変更の並びは正しいまま、最小ではなくなる）
const LCS_CELL_CAP = 4_000_000;

/**
 * 今の行（ID付き）と書き込み後の行の差分を、編集 API の変更に直す。
 *
 * 先頭と末尾の共通部分を除き、残った中ほどを LCS で対応させる。1つの変更箇所の中では、
 * 消える行と増える行を上から 1 対 1 で書き換えにし（行 ID と作者の記録が残る）、余りを削除か、
 * 次に残る行の直前への挿入にする（最後なら `_end`）。挿入の目印は残る行なので、同じ要求の中の
 * 削除と食い違わない。
 */
export function diffToEditChanges(before: BaseLine[], after: string[], cellCap = LCS_CELL_CAP): EditChange[] {
  const oldTexts = before.map(line => line.text);
  let start = 0;
  while (start < oldTexts.length && start < after.length && oldTexts[start] === after[start]) start++;
  let oldEnd = oldTexts.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && oldTexts[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const steps = middleSteps(oldTexts.slice(start, oldEnd), after.slice(start, newEnd), cellCap);
  const changes: EditChange[] = [];
  let deleted: number[] = [];
  let added: string[] = [];
  const flush = (anchorIndex: number) => {
    const paired = Math.min(deleted.length, added.length);
    for (let k = 0; k < paired; k++) {
      changes.push({ _update: before[deleted[k]!]!.id, lines: { text: added[k]! } });
    }
    for (let k = paired; k < deleted.length; k++) {
      changes.push({ _delete: before[deleted[k]!]!.id });
    }
    const anchor = before[anchorIndex]?.id ?? '_end';
    for (let k = paired; k < added.length; k++) {
      changes.push({ _insert: anchor, lines: { id: newLineId(), text: added[k]! } });
    }
    deleted = [];
    added = [];
  };

  let oldIndex = start;
  let newIndex = start;
  for (const step of steps) {
    if (step === 'keep') {
      flush(oldIndex);
      oldIndex++;
      newIndex++;
    } else if (step === 'delete') {
      deleted.push(oldIndex++);
    } else {
      added.push(after[newIndex++]!);
    }
  }
  flush(oldEnd);
  return changes;
}

type Step = 'keep' | 'delete' | 'insert';

function middleSteps(a: string[], b: string[], cellCap: number): Step[] {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > cellCap) {
    // 表が大きすぎるときは全部を1つの変更箇所にする。flush が上から順に書き換えへ対にする
    return [...Array<Step>(n).fill('delete'), ...Array<Step>(m).fill('insert')];
  }
  // lcs[i * (m + 1) + j] = a[i..] と b[j..] の LCS の長さ
  const lcs = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * (m + 1) + j] = a[i] === b[j]
        ? lcs[(i + 1) * (m + 1) + j + 1]! + 1
        : Math.max(lcs[(i + 1) * (m + 1) + j]!, lcs[i * (m + 1) + j + 1]!);
    }
  }
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      steps.push('keep');
      i++;
      j++;
    } else if (lcs[(i + 1) * (m + 1) + j]! >= lcs[i * (m + 1) + j + 1]!) {
      steps.push('delete');
      i++;
    } else {
      steps.push('insert');
      j++;
    }
  }
  while (i++ < n) steps.push('delete');
  while (j++ < m) steps.push('insert');
  return steps;
}
