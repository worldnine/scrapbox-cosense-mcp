# Authentication

Public projects can be read without any credential. Private projects, editing, and `get_smart_context` need one of the following.

| Credential | How to set it | Writes go through |
|---|---|---|
| Personal Access Token (recommended) | `COSENSE_MCP_PAT` | Edit API |
| Service Account (Business plan, one project) | `COSENSE_MCP_PAT` (the access key starts with `cs_`) | Edit API |
| Session ID (`connect.sid` cookie) | `COSENSE_SID` | WebSocket API |

If both are set, `COSENSE_SID` is used, so an existing setup keeps working exactly as before. To switch to a Personal Access Token, set `COSENSE_MCP_PAT` and remove `COSENSE_SID`.

The variable is `COSENSE_MCP_PAT`, not `COSENSE_PAT` that the official CLI reads. A token you export in your shell for the official CLI is inherited by MCP servers, and it would otherwise give this server write access you never set up for it.

The server does not read `~/.cosense/settings.json`, where `cosense login` of the official CLI saves its token. Reading it would let this server write as soon as you log in with the official CLI, even when you gave this server no credential on purpose (for example, to only read public projects). A credential that can write is used only when you set it for this server.

## Personal Access Token (recommended)

1. Open https://scrapbox.io/settings/personal-access-tokens and issue a token
2. Set it as `COSENSE_MCP_PAT` in your MCP configuration

A Personal Access Token reaches everything your account can see. It cannot be limited to one project or to reading. Use `COSENSE_PROJECT_ALLOW_LIST` to limit which projects this server may target, and delete the token on the same settings page if it leaks.

## Service Account (Business plan)

A Service Account belongs to a single project. Register one in the project's settings (**Service Accounts** tab) and set its access key as `COSENSE_MCP_PAT`. The key starts with `cs_`, which is how the server tells it apart from a Personal Access Token. It can only reach that project, so pair it with `COSENSE_PROJECT_NAME` for the same project.

## Session ID (`connect.sid` cookie)

This is how the server has always authenticated, and it keeps working as it is. The edit API refuses writes authenticated by a cookie, so with a session ID the server writes through the WebSocket API, as it always has.

1. **Navigate to your project** — Open `https://scrapbox.io/YOUR_PROJECT_NAME` and log in

2. **Open Developer Tools**
   - **Windows/Linux**: `F12` or `Ctrl+Shift+I`
   - **macOS**: `Cmd+Option+I`

3. **Find the cookie**
   - Go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
   - Expand **Cookies** → click `https://scrapbox.io`
   - Find the cookie named `connect.sid`

4. **Copy the decoded value**
   - The browser shows the URL-encoded value: `s%3Axxxxxxxx-xxxx-...`
   - You need the **decoded** value: `s:xxxxxxxx-xxxx-...` (note `:` instead of `%3A`)

5. **Set the environment variable**
   ```
   COSENSE_SID=s:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Notes

- Keep your `connect.sid` value secure — it is your browser session and can do anything you can do in the browser
- The cookie may expire; obtain a new one if authentication fails

---

# 認証

公開プロジェクトは資格情報なしで読めます。非公開プロジェクト、編集、`get_smart_context`には、次のどれかが必要です。

| 資格情報 | 設定のしかた | 書き込みの経路 |
|---|---|---|
| Personal Access Token（おすすめ） | `COSENSE_MCP_PAT` | 編集API |
| Service Account（Business plan、1プロジェクト限定） | `COSENSE_MCP_PAT`（アクセスキーは`cs_`で始まる） | 編集API |
| セッションID（`connect.sid` Cookie） | `COSENSE_SID` | WebSocket API |

両方あれば`COSENSE_SID`を使うので、今の設定はそのまま動きます。Personal Access Tokenに移るときは、`COSENSE_MCP_PAT`を入れて`COSENSE_SID`を外してください。

変数名は、公式CLIが読む`COSENSE_PAT`ではなく`COSENSE_MCP_PAT`です。公式CLIのためにシェルでexportしたトークンはMCPサーバーにも受け継がれるので、同じ名前だと、このサーバーに設定したつもりのない書き込みの力を持たせてしまうためです。

公式CLIの`cosense login`がトークンを保存する`~/.cosense/settings.json`は読みません。読むと、このサーバーにわざと資格情報を渡していない場合（公開プロジェクトを読むだけ、など）でも、公式CLIでログインしただけで書き込めるようになってしまうためです。書き込める資格情報は、このサーバーに設定したときだけ使います。

## Personal Access Token（おすすめ）

1. https://scrapbox.io/settings/personal-access-tokens を開いてトークンを発行する
2. MCPの設定の`COSENSE_MCP_PAT`に入れる

Personal Access Tokenは、自分のアカウントで見られる範囲すべてに届きます。1つのプロジェクトや読み取りだけに絞ることはできません。このサーバーが扱えるプロジェクトは`COSENSE_PROJECT_ALLOW_LIST`で絞れます。トークンが漏れたら、同じ設定画面から消してください。

## Service Account（Business plan）

Service Accountは1つのプロジェクトに属します。プロジェクトの設定の**Service Accounts**タブで登録し、アクセスキーを`COSENSE_MCP_PAT`に入れてください。アクセスキーは`cs_`で始まり、サーバーはそれでPersonal Access Tokenと見分けます。そのプロジェクトにしか届かないので、`COSENSE_PROJECT_NAME`も同じプロジェクトにしてください。

## セッションID（`connect.sid` Cookie）

これまでの認証のしかたで、今までどおり動きます。編集APIはCookieで認証した書き込みを受け付けないため、セッションIDのときはこれまでどおりWebSocket APIで書き込みます。

1. **Scrapboxプロジェクトにアクセス** — `https://scrapbox.io/あなたのプロジェクト名` を開いてログイン

2. **開発者ツールを開く**
   - **Windows/Linux**: `F12` または `Ctrl+Shift+I`
   - **macOS**: `Cmd+Option+I`

3. **Cookieを確認**
   - **Application** タブ（Chrome/Edge）または **ストレージ** タブ（Firefox）
   - **Cookies** を展開 → `https://scrapbox.io` をクリック
   - `connect.sid` という名前のCookieを探す

4. **デコード済みの値をコピー**
   - ブラウザ表示（URLエンコード済み）: `s%3Axxxxxxxx-xxxx-...`
   - 使用すべき値（デコード済み）: `s:xxxxxxxx-xxxx-...`（`%3A` ではなく `:` ）

5. **環境変数に設定**
   ```
   COSENSE_SID=s:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 注意事項

- `connect.sid` の値は安全に管理してください。ブラウザのログインそのもので、ブラウザでできることは何でもできます
- Cookieは期限切れになることがあります。認証エラーが発生したら新しいCookieを取得してください
