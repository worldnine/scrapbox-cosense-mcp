# 変更履歴

v0.12.0 以前のリリースノートは [GitHub Releases](https://github.com/worldnine/scrapbox-cosense-mcp/releases) にある。

## v0.13.0

### 新機能

- Personal Access Token と Service Account で、公開・非公開プロジェクトの読み取りと、ページの作成・編集ができるようにした（#79）
  - 設定する環境変数は `COSENSE_MCP_PAT`。`cs_` で始まる値は Service Account のアクセスキーとして送る
  - 公式 CLI の `COSENSE_PAT` と `~/.cosense/settings.json` は読まない。MCP サーバーは親プロセスの環境を受け継ぐため、公式 CLI 用に export したトークンだけでは書き込めない
  - `COSENSE_SID` が設定されていれば SID を優先する。SID だけの環境の書き込み経路は変わらない。SID の書き込みが失敗し、かつ `COSENSE_MCP_PAT` もあるときは、SID が優先されている旨をエラーに添える
  - 書き込みは資格情報で経路が分かれる。PAT / Service Account は編集 API（`/api/pages/v2/<project>/page-edit-for-ai/preview` → `submit`）、`COSENSE_SID` はこれまでどおり WebSocket の `patch()`
  - `create_page` / `insert_lines` / `edit_lines` / `delete_lines` / `delete_page` / `rewrite_page`、読み取り、`get_smart_context`、メンバー一覧（作成者・編集者の名前）が PAT でも使える
  - 編集 API は、読んでから preview までの間に入った他人の編集を行 ID で上書きしない。preview の `commitId` が読んだ版と違えば送り直し、preview 後の変更は 409 `NotFastForward` で読み直す（最大 3 回）
  - Claude Desktop 拡張（`.mcpb`）の設定画面に Personal Access Token の欄を足した

### リファクタリング

- Server の組み立て（`new Server` からルート登録まで）を `createServer()` に括り出した（#76）。stdio の挙動は変えない。セッションごとに独立した Server が要るトランスポートを後から足せるようにするため

### ドキュメント

- 認証の説明を PAT 中心に書き直した（`docs/authentication.md`、README、日本語版、複数プロジェクトの文書、SKILL.md、CLAUDE.md）（#79）
- `rewrite_page` はページ全体を置き換える。書き換えの途中で別の編集が入ると、409 の再試行で同じ全文が再適用され、その同時編集は黙って失われる。README と日本語版にその旨を書いた（#79）

### 開発

- `package-lock.json` を `package.json` に合わせた（`npm install` が足していた optional な peer 依存）（#79）

### 変更なし

- `COSENSE_SID` だけの環境の書き込みは、これまでどおり WebSocket の `patch()` のまま
- `delete_page` / `rewrite_page` は、これまでどおり `COSENSE_ENABLE_DELETE=true` のときだけ登録される
