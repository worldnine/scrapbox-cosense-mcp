# scrapbox-cosense-mcp

[English README](../README.md)

[Cosense (旧 Scrapbox)](https://cosen.se) 用のMCPサーバーです。

## 機能

| ツール | 説明 | 認証 |
|--------|------|:---:|
| `get_page` | ページコンテンツ、メタデータ、リンクを取得 | プライベートプロジェクトのみ |
| `list_pages` | ソート・ページネーション付きでページ一覧を取得（最大1000件） | プライベートプロジェクトのみ |
| `search_pages` | キーワード検索（検索語句ハイライト付き、最大100件） | プライベートプロジェクトのみ |
| `create_page` | ページを作成（Markdown/Scrapbox本文対応） | 必要 |
| `get_page_url` | ページの直接URLを生成 | 不要 |
| `insert_lines` | ページの指定行の後にテキストを挿入 | 必要 |
| `edit_lines` | 完全一致した行（複数行ブロックも可）を置換（既定は最初の1件、`matchAll` で全件） | 必要 |
| `delete_lines` | 完全一致した行（複数行ブロックも可）を削除（既定は最初の1件、`matchAll` で全件） | 必要 |
| `delete_page` | ページを削除（オプトイン制。下記参照） | 必要 |
| `rewrite_page` | ページ全体を新しい内容に置換（オプトイン制。下記参照） | 必要 |

`create_page` と `insert_lines` と `edit_lines` と `rewrite_page` は `format` パラメータ（`"markdown"` または `"scrapbox"`）でコンテンツ変換を制御できます。

`edit_lines` は既定では最初に一致した行だけを置換します。全件を置換するには `matchAll: true` を指定してください。既定値を控えめにしているのは意図的です。箇条書きの記号だけの行や空行のように、同じ文字列の行がページ内に何度も現れることがあり、それらを一度にすべて置き換えるのは呼び出し側の意図と異なる場合が多いためです。

`targetLineText` に改行を含めると、連続する行ブロックの完全一致として扱います。ブロック全体をまとめて置換するため、n行をm行（例: 数行を1行にまとめる）に置き換えられます。`matchAll: true` のときのブロック一致は非重複（前から走査）です。

`delete_lines` は同じ完全一致（ブロック対応）の仕組みで、マッチした行を置換ではなく削除します。タイトル行（先頭行）の削除は拒否します。ページのリネーム（または全行消去による消滅）を起こすためで、`delete_page` を使うよう案内します。

### `delete_page` と `rewrite_page` はオプトイン制です

`delete_page` と `rewrite_page` は、**`COSENSE_ENABLE_DELETE=true` を設定したときだけ登録されます**。設定していなければツール一覧にも現れないので、エージェントが誤って呼ぶこともありません。このサーバーは共有のMCP設定に入れて使われることも多いため、ページ全体を破壊しうる操作は意図的に有効化した利用者にだけ露出させています。

考え方の基準は「呼び出し側が既存内容を知っていることの証明」です。`insert_lines` / `edit_lines` / `delete_lines` は完全一致が前提のため、実際にページを読んでいないと成功せず、壊せるのは「自分が見た行」だけです。一方 `delete_page` / `rewrite_page` は読んでいない内容も丸ごと破壊できるため、別途オプトインのゲートを設けています。

`delete_page` はページ全体を削除します。取り消しはできません。さらに2つの安全策を入れてあります。

- 対象のページが存在していることを確認します。存在しない場合は、黙って成功せずにエラーを返します。CosenseのREST APIは未作成のページに対してもタイトル行を返すため、行数ではなく `persistent` で判定しています。`create_page` の既存ページ判定と同じやり方です。
- `dryRun: true` を指定すると、削除される行数と冒頭5行を報告するだけで、ページには一切触れません。

`rewrite_page` はページ全体を新しい内容に置換します（タイトルは先頭行として残ります）。上記と同じ安全策に加えて、次の2つがあります。

- 対象のページが存在しない場合はエラーになります。`create_page` とは `persistent` の判定を逆にして、タイトルのタイポが新規ページを黙って生む事故を防ぎます。
- 空の内容は拒否します。ページを消すのは `delete_page` の役割です。
- `dryRun: true` を指定すると、置換前後の行数とプレビューを報告するだけで、ページには一切触れません。

`rewrite_page` はページ全体を置き換えます。書き換えの途中で別の編集が入ると、409 の再試行で書き換えが再適用され、その同時編集は黙って失われます。

プロジェクトごとに複数のインスタンスを動かしている場合は、削除を許すインスタンスにだけこの変数を設定してください。

```json
{
  "mcpServers": {
    "cosense-notes": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "notes",
        "COSENSE_MCP_PAT": "your-personal-access-token",
        "COSENSE_TOOL_SUFFIX": "notes",
        "COSENSE_ENABLE_DELETE": "true"
      }
    },
    "cosense-archive": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "archive",
        "COSENSE_MCP_PAT": "your-personal-access-token",
        "COSENSE_TOOL_SUFFIX": "archive"
      }
    }
  }
}
```

この例では `notes` のインスタンスだけが `delete_page_notes` を持ち、`archive` のインスタンスには削除のツールが現れません。

`insert_lines` と `edit_lines` は、対象の行が見つからなかったときの挙動が異なります。`insert_lines` はページの末尾に追記します。「このテキストをどこかに足す」という要求には、末尾という妥当な着地点があるからです。`edit_lines` はエラーを返し、ページを変更しません。「この特定の行を置き換える」という要求には代わりの着地点がなく、置換内容を末尾に追記してしまえば、呼び出し側が求めていないページが黙って出来上がるためです。

## クイックスタート

### 方法A: Desktop Extension (.mcpb) — 最も簡単

1. [GitHub Releases](https://github.com/worldnine/scrapbox-cosense-mcp/releases) から `scrapbox-cosense-mcp.mcpb` をダウンロード
2. ダブルクリック — Claude Desktopのインストールダイアログが開きます
3. プロジェクト名（非公開プロジェクトや編集には[Personal Access Token](./authentication.md)も）を入力

### 方法B: Claude Code プラグイン

1. マーケットプレイスを追加:
   ```
   /plugin marketplace add worldnine/scrapbox-cosense-mcp
   ```
2. プラグインをインストール:
   ```
   /plugin install scrapbox-cosense@worldnine-scrapbox-cosense-mcp
   ```
   デフォルトでグローバルにインストールされます。`--scope project` や `--scope local` で変更可能。
3. 環境変数を設定:
   ```json
   {
     "env": {
       "COSENSE_PROJECT_NAME": "your_project_name",
       "COSENSE_MCP_PAT": "your_personal_access_token"
     }
   }
   ```
   | ファイル | スコープ |
   |----------|----------|
   | `~/.claude/settings.json` | 全プロジェクト共通（グローバル） |
   | `.claude/settings.local.json` | このプロジェクトのみ（gitignore対象） |

MCPサーバー設定が自動適用され、`/cosense` スキルも利用可能になります。

### 方法C: Claude Code（手動MCP設定）

プラグインを使わず手動で設定する場合:

```bash
claude mcp add scrapbox-cosense-mcp \
  -e COSENSE_PROJECT_NAME=your_project \
  -e COSENSE_MCP_PAT=your_personal_access_token \
  -- npx -y scrapbox-cosense-mcp
```

### 方法D: Claude Desktop / 他のMCPクライアント

設定ファイルに追加してください：

| クライアント | 設定ファイル |
|-------------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json`（プロジェクトルート） |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "your_project_name",
        "COSENSE_MCP_PAT": "your_personal_access_token"
      }
    }
  }
}
```

### 方法E: ソースからビルド

```bash
git clone https://github.com/worldnine/scrapbox-cosense-mcp.git
cd scrapbox-cosense-mcp
npm install && npm run build
```

## 環境変数

### 必須

| 変数 | 説明 |
|------|------|
| `COSENSE_PROJECT_NAME` | Scrapbox/Cosenseのプロジェクト名 |

### 認証

公開プロジェクトは資格情報なしで読めます。非公開プロジェクト、編集、`get_smart_context`には資格情報が必要です。詳しくは[認証](./authentication.md)を参照してください。

| 変数 | 説明 |
|------|------|
| `COSENSE_MCP_PAT` | Personal Access Token（おすすめ）。`https://scrapbox.io/settings/personal-access-tokens`で発行する。書き込みは編集APIを通る |
| `COSENSE_SID` | セッションID（`connect.sid` Cookie）。`COSENSE_MCP_PAT`より優先するので、今の設定はそのまま動く。PATに移るときは外す。書き込みはWebSocket APIを通る |

Service Account（Business plan）のアクセスキー（`cs_`で始まる）も`COSENSE_MCP_PAT`に入れます。

### オプション

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `API_DOMAIN` | `scrapbox.io` | APIドメイン |
| `SERVICE_LABEL` | `cosense (scrapbox)` | ツール説明に表示される名前 |
| `COSENSE_PAGE_LIMIT` | `100` | 初期取得ページ数（1–1000） |
| `COSENSE_SORT_METHOD` | `updated` | 初期ソート順: updated, created, accessed, linked, views, title |
| `COSENSE_TOOL_SUFFIX` | — | 複数インスタンス用のツール名サフィックス（例: `main` → `get_page_main`） |
| `COSENSE_CONVERT_NUMBERED_LISTS` | `false` | Markdown変換時に数字付きリストを箇条書きに変換 |
| `COSENSE_EXCLUDE_PINNED` | `false` | 初期リソース一覧からピン留めページを除外 |
| `COSENSE_ENABLE_DELETE` | `false` | `delete_page` / `rewrite_page` ツール（および `delete` / `rewrite` サブコマンド）を有効にする。設定しなければどれも使えない |
| `COSENSE_PROJECT_ALLOW_LIST` | — | `projectName`/`--project`で指定できるプロジェクト（カンマ区切り）。`COSENSE_PROJECT_NAME`は常に許可。未設定なら制限なし、空の値なら既定のプロジェクトだけ |
| `TRANSPORT` | stdio | `http`にすると、stdioの代わりに`/mcp`でStreamable HTTPを提供する。認証が無いと、`MCP_ALLOW_UNAUTHENTICATED=true`（ローカル専用）でない限り起動を拒否する |
| `PORT` | `3000` | HTTP transportのポート |
| `MCP_HTTP_HOST` | `127.0.0.1` | HTTP transportが待ち受けるアドレス。localhost以外にするときは`MCP_ALLOWED_HOSTS`も設定する |
| `MCP_ALLOWED_HOSTS` | — | HTTP transportが受け付ける`Host`ヘッダの値（カンマ区切り、DNSリバインディング対策） |
| `MCP_PUBLIC_URL` | — | HTTP transportの公開origin（例: `https://mcp.example.com`）。`MCP_OAUTH_PASSPHRASE`と両方そろうとOAuth 2.1が有効になる。片方だけだとエラー |
| `MCP_OAUTH_PASSPHRASE` | — | クライアントの接続時に同意画面で入力するパスフレーズ（12文字以上） |
| `MCP_OAUTH_STORE` | — | 登録済みクライアントとトークンを保存するファイル。未設定ならメモリだけで、再起動のたびにクライアントの再認可が要る |
| `MCP_OAUTH_ACCESS_TTL` / `MCP_OAUTH_REFRESH_TTL` | `3600` / `2592000` | アクセストークン/リフレッシュトークンの有効期間（秒） |
| `MCP_OAUTH_RESOURCE_NAME` | `Cosense MCP` | 同意画面とメタデータに出る名前 |
| `MCP_TRUST_PROXY` | — | リバースプロキシの背後で動かすときの、Expressの`trust proxy`の値（プロキシの段数かアドレス）。ログイン試行のレート制限が実際の接続元IPを見るために要る |
| `MCP_ALLOW_UNAUTHENTICATED` | — | `true`にすると、HTTP transportを認証なしで起動できる |

## 複数プロジェクト対応

すべてのツールでオプションの `projectName` パラメータを指定して、異なるプロジェクトにアクセスできます。異なる認証情報を持つ複数のプライベートプロジェクトには、`COSENSE_TOOL_SUFFIX` を使った複数サーバーインスタンスが推奨です。

詳細は [docs/multiple-projects.md](./multiple-projects.md) を参照してください。

## HTTP transport

`TRANSPORT=http`にすると、`/mcp`でStreamable HTTPを提供します。Claude.aiやChatGPTのようなリモートのクライアントからつなげます。クライアントはサーバー自身が提供するOAuth 2.1でログインします。認証が無いと起動を拒否します。

```bash
TRANSPORT=http \
COSENSE_PROJECT_NAME=your_project \
COSENSE_MCP_PAT=your_personal_access_token \
MCP_PUBLIC_URL=https://mcp.example.com \
MCP_OAUTH_PASSPHRASE=your_passphrase_of_12_or_more_chars \
MCP_OAUTH_STORE=/data/oauth-store.json \
npx -y scrapbox-cosense-mcp
```

クライアントには`https://mcp.example.com/mcp`を入力し、同意画面でパスフレーズを入力します。

- **Cosenseの資格情報にはPersonal Access Tokenを使ってください。** セッションIDはブラウザのログインそのもので、期限が切れます。切れると、入れ替えるまでツールの呼び出しがすべて失敗します。`COSENSE_SID`は`COSENSE_MCP_PAT`より優先されるので、サーバーの環境には入れないでください
- 同意画面を通ったクライアントは、どれもこの1つの資格情報で動きます。届くプロジェクトは`COSENSE_PROJECT_ALLOW_LIST`で絞ってください
- リバースプロキシの背後で動かすときは、`MCP_ALLOWED_HOSTS`と`MCP_TRUST_PROXY`も見てください

詳しくは[認証](./authentication.md)の「HTTP transportの認証（OAuth 2.1）」を参照してください。

## 開発

| コマンド | 説明 |
|---------|------|
| `npm run build` | ビルド（TypeScript → JavaScript） |
| `npm run watch` | 開発時の自動リビルド |
| `npm test` | テスト実行 |
| `npm run lint` | ESLint実行 |
| `npm run inspector` | MCP Inspectorでデバッグ |

### 貢献ガイドライン

1. `main` から機能ブランチを作成
2. テストを追加して変更を実装
3. `npm run lint && npm test` を実行
4. プルリクエストを作成 — CIが自動実行されます

## コントリビューター

このプロジェクトに貢献してくださったみなさんに感謝します。

- [@kmatsunami](https://github.com/kmatsunami) — `get_page` の collaborators 未定義時の対応、JSR依存の解決 ([#20](https://github.com/worldnine/scrapbox-cosense-mcp/pull/20))
- [@vitalibondar](https://github.com/vitalibondar) — `format` パラメータの追加、裸のURLが二重になる不具合の修正 ([#29](https://github.com/worldnine/scrapbox-cosense-mcp/pull/29))
- [@qurihara](https://github.com/qurihara) — `edit_lines`、オプトイン制の `delete_page` ([#52](https://github.com/worldnine/scrapbox-cosense-mcp/pull/52), [#57](https://github.com/worldnine/scrapbox-cosense-mcp/pull/57))
- [@ojimpo](https://github.com/ojimpo) — `COSENSE_PROJECT_ALLOW_LIST`、OAuth 2.1つきのHTTP transport ([#68](https://github.com/worldnine/scrapbox-cosense-mcp/pull/68), [#76](https://github.com/worldnine/scrapbox-cosense-mcp/pull/76), [#78](https://github.com/worldnine/scrapbox-cosense-mcp/pull/78), [#81](https://github.com/worldnine/scrapbox-cosense-mcp/pull/81))
- [@punkpeye](https://github.com/punkpeye), [@lwsinclair](https://github.com/lwsinclair) — READMEのバッジ ([#1](https://github.com/worldnine/scrapbox-cosense-mcp/pull/1), [#6](https://github.com/worldnine/scrapbox-cosense-mcp/pull/6))

全体は [contributors グラフ](https://github.com/worldnine/scrapbox-cosense-mcp/graphs/contributors) にあります。
