# Authentication

Public projects can be read without any credential. Private projects, editing, and `get_smart_context` need one of the following.

| Credential | How to set it | Writes go through |
|---|---|---|
| Personal Access Token (recommended) | `COSENSE_PAT`, or `cosense login` | Edit API |
| Service Account (Business plan, one project) | `cosense login https://scrapbox.io/<project>` | Edit API |
| Session ID (`connect.sid` cookie) | `COSENSE_SID` | WebSocket API |

When several are available, the first match wins:

1. `COSENSE_PAT`
2. `COSENSE_SID`
3. `~/.cosense/settings.json` (saved by `cosense login` of the official CLI): the Service Account for the project, then the Personal Access Token

Environment variables come before the settings file so that running `cosense login` does not silently change how an existing `COSENSE_SID` setup writes.

## Personal Access Token (recommended)

1. Open https://scrapbox.io/settings/personal-access-tokens and issue a token
2. Set it as `COSENSE_PAT` in your MCP configuration

If you also use the official CLI ([@helpfeel/cosense-cli](https://www.npmjs.com/package/@helpfeel/cosense-cli)), `cosense login https://scrapbox.io` saves the token to `~/.cosense/settings.json`, and this server reads it from there without `COSENSE_PAT`.

A Personal Access Token reaches everything your account can see. It cannot be limited to one project or to reading. Use `COSENSE_PROJECT_ALLOW_LIST` to limit which projects this server may target, and delete the token on the same settings page if it leaks.

## Service Account (Business plan)

A Service Account belongs to a single project. Register one in the project's settings (**Service Accounts** tab), then run `cosense login https://scrapbox.io/<project>` and paste the access key. This server picks it up from `~/.cosense/settings.json` for that project only.

## Session ID (`connect.sid` cookie)

Use this only if you do not use a Personal Access Token. The edit API refuses writes authenticated by a cookie, so with a session ID the server writes through the WebSocket API, as it always has.

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
| Personal Access Token（おすすめ） | `COSENSE_PAT`、または`cosense login` | 編集API |
| Service Account（Business plan、1プロジェクト限定） | `cosense login https://scrapbox.io/<project>` | 編集API |
| セッションID（`connect.sid` Cookie） | `COSENSE_SID` | WebSocket API |

複数ある場合は、上から順に最初に見つかったものを使います。

1. `COSENSE_PAT`
2. `COSENSE_SID`
3. `~/.cosense/settings.json`（公式CLIの`cosense login`が保存するもの）。そのプロジェクトのService Account、次にPersonal Access Token

環境変数を設定ファイルより先にしているのは、`cosense login`をしただけで、`COSENSE_SID`で使っている環境の書き込み経路が知らないうちに変わらないようにするためです。

## Personal Access Token（おすすめ）

1. https://scrapbox.io/settings/personal-access-tokens を開いてトークンを発行する
2. MCPの設定の`COSENSE_PAT`に入れる

公式CLI（[@helpfeel/cosense-cli](https://www.npmjs.com/package/@helpfeel/cosense-cli)）も使っているなら、`cosense login https://scrapbox.io`でトークンが`~/.cosense/settings.json`に保存されます。このサーバーはそこからも読むので、`COSENSE_PAT`は無くても動きます。

Personal Access Tokenは、自分のアカウントで見られる範囲すべてに届きます。1つのプロジェクトや読み取りだけに絞ることはできません。このサーバーが扱えるプロジェクトは`COSENSE_PROJECT_ALLOW_LIST`で絞れます。トークンが漏れたら、同じ設定画面から消してください。

## Service Account（Business plan）

Service Accountは1つのプロジェクトに属します。プロジェクトの設定の**Service Accounts**タブで登録し、`cosense login https://scrapbox.io/<project>`でアクセスキーを貼り付けてください。このサーバーは`~/.cosense/settings.json`から、そのプロジェクトに対してだけ使います。

## セッションID（`connect.sid` Cookie）

Personal Access Tokenを使わない場合だけ必要です。編集APIはCookieで認証した書き込みを受け付けないため、セッションIDのときはこれまでどおりWebSocket APIで書き込みます。

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
