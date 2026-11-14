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

## HTTP transport authentication (OAuth 2.1)

This is about who may connect **to the MCP server** over HTTP, and is separate from the Cosense credential above. Remote clients such as Claude.ai and ChatGPT only accept OAuth 2.1 for MCP servers, so that is the only mechanism the HTTP transport offers.

```
TRANSPORT=http
MCP_PUBLIC_URL=https://mcp.example.com   # the origin clients reach this server at
MCP_OAUTH_PASSPHRASE=<12+ characters>
MCP_OAUTH_STORE=/data/oauth-store.json   # optional, see below
```

- The authorization server runs inside the same process. Clients register themselves (RFC 7591), send you to a consent screen on this server, and you approve by typing `MCP_OAUTH_PASSPHRASE`.
- Without a valid access token, `/mcp` answers `401` with a `WWW-Authenticate` header that points to the protected resource metadata (RFC 9728).
- Tokens are bound to this server (`resource`, RFC 8707): a token issued for another resource is rejected.
- Access tokens last an hour and refresh tokens 30 days (`MCP_OAUTH_ACCESS_TTL`, `MCP_OAUTH_REFRESH_TTL`).
- **Set `MCP_OAUTH_STORE`.** Tokens are only hashed on disk, but registered clients are written as they are, client secrets included, so keep the file private; without a store they live in memory, and every restart makes each client authorize again.
- The URL users enter in the client must be exactly `<MCP_PUBLIC_URL origin>/mcp`. A mismatch sends the client into a re-authorization loop.
- Behind a reverse proxy, set `MCP_TRUST_PROXY` so the sign-in rate limit (10 attempts per 15 minutes per client IP) sees the real address.
- The server refuses to start the HTTP transport with neither OAuth nor `MCP_ALLOW_UNAUTHENTICATED=true`.

Which user a grant belongs to is decided by a `ConsentAuthenticator` (`src/auth/authenticator.ts`). The built-in one compares the passphrase and returns a single user. To authenticate people differently, pass another implementation as `OAuthConfig.authenticator`; its user ID ends up in `AuthInfo.extra.userId`.

### The Cosense credential on an HTTP server

Use a Personal Access Token (`COSENSE_MCP_PAT`). A session ID is your browser login itself, and it expires; from then on every tool call fails until you replace it by hand. Deleting a token, on the other hand, does not log you out of the browser. `COSENSE_SID` takes precedence when both are set, so leave it out of the server's environment.

Every client that gets through the consent screen acts with this one credential. Limit the reachable projects with `COSENSE_PROJECT_ALLOW_LIST`.

### Behind a reverse proxy

`MCP_PUBLIC_URL` must use https (except on `localhost`), so a public server usually listens on `127.0.0.1` behind a reverse proxy that terminates TLS. Two settings depend on how the proxy forwards requests:

- **`MCP_ALLOWED_HOSTS`**: by default the server accepts only `localhost`, `127.0.0.1`, and `[::1]` in the `Host` header (DNS rebinding protection). If the proxy passes the public host name, every request — the consent screen and `/health` included — answers `403 Invalid Host` until you set `MCP_ALLOWED_HOSTS=mcp.example.com`. The variable replaces the default, so add `localhost` or `127.0.0.1` too if anything also reaches the server directly.
- **`MCP_TRUST_PROXY`**: without it every request seems to come from the proxy, so the sign-in rate limit (10 attempts per 15 minutes per client IP) is shared by everyone, and ten wrong passphrases from anyone lock the owner out as well. Set the number of proxies in front (`1` for one) or their address (`loopback` when the proxy runs on the same machine). `true` does not work (the server stops at startup with `invalid IP address: true`), and it would not be safe anyway: it trusts any `X-Forwarded-For` a client sends, so anyone could dodge the limit.


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

## HTTP transportの認証（OAuth 2.1）

Cosenseへの資格情報とは別の話で、HTTPで公開したMCPサーバーに**誰が接続してよいか**を決める仕組みです。Claude.aiやChatGPTのようなリモートのクライアントは、MCPサーバーにOAuth 2.1しか使えません。そのため、HTTP transportの認証手段もこれ1つにしています。

```
TRANSPORT=http
MCP_PUBLIC_URL=https://mcp.example.com   # クライアントがこのサーバーに届く origin
MCP_OAUTH_PASSPHRASE=<12文字以上>
MCP_OAUTH_STORE=/data/oauth-store.json   # 任意。下を参照
```

- 認可サーバーは同じプロセスの中で動きます。クライアントが自分で登録（RFC 7591）し、このサーバーの同意画面に案内します。`MCP_OAUTH_PASSPHRASE` を入力して承認します
- 有効なアクセストークンが無いと、`/mcp` は `401` と `WWW-Authenticate` ヘッダを返します。ヘッダはProtected Resource Metadata（RFC 9728）を指します
- トークンはこのサーバー宛てに束縛されます（`resource`、RFC 8707）。別のリソース向けに発行されたトークンは拒否します
- アクセストークンは1時間、リフレッシュトークンは30日です（`MCP_OAUTH_ACCESS_TTL`、`MCP_OAUTH_REFRESH_TTL`）
- **`MCP_OAUTH_STORE` は設定してください。** トークンは、ハッシュでしかディスクに残りません。登録済みクライアントはクライアントシークレットも含めてそのまま残るので、ファイルは人に見せないでください。ストアが無いとメモリだけになり、再起動のたびに全クライアントが再認可になります
- 利用者がクライアントに入力するURLは、`<MCP_PUBLIC_URL の origin>/mcp` と完全に一致させてください。ずれると再認可のループに入ります
- リバースプロキシの背後では `MCP_TRUST_PROXY` を設定してください。ログイン試行のレート制限（接続元IPごとに15分で10回）が、実際のIPを見られるようになります
- OAuthも `MCP_ALLOW_UNAUTHENTICATED=true` も無いと、HTTP transportは起動を拒否します

認可がどの利用者のものかは、`ConsentAuthenticator`（`src/auth/authenticator.ts`）が決めます。組み込みの実装はパスフレーズを照合して、利用者を1人だけ返します。人ごとに認証を変えたい場合は、別の実装を `OAuthConfig.authenticator` に渡してください。返した利用者IDは `AuthInfo.extra.userId` に入ります。

### HTTPで公開するときのCosenseの資格情報

Personal Access Token（`COSENSE_MCP_PAT`）を使ってください。セッションIDはブラウザのログインそのもので、期限が切れます。切れると、手で入れ替えるまでツールの呼び出しがすべて失敗します。トークンなら、消してもブラウザはログアウトしません。両方あると`COSENSE_SID`が優先されるので、サーバーの環境には入れないでください。

同意画面を通ったクライアントは、どれもこの1つの資格情報で動きます。届くプロジェクトは`COSENSE_PROJECT_ALLOW_LIST`で絞ってください。

### リバースプロキシの背後で動かすとき

`MCP_PUBLIC_URL`はhttpsでなければならない（`localhost`を除く）ので、公開するサーバーはふつう`127.0.0.1`で待ち受け、TLSを終端するリバースプロキシの背後に置きます。プロキシの転送のしかたによって、次の2つの設定が要ります。

- **`MCP_ALLOWED_HOSTS`**: 既定では、`Host`ヘッダが`localhost`、`127.0.0.1`、`[::1]`のものしか受け付けません（DNSリバインディング対策）。プロキシが公開のホスト名をそのまま渡す場合、`MCP_ALLOWED_HOSTS=mcp.example.com`を設定するまで、同意画面や`/health`も含めてすべての要求が`403 Invalid Host`になります。この変数は既定を置き換えるので、サーバーに直接つなぐものもあるなら`localhost`か`127.0.0.1`も足してください
- **`MCP_TRUST_PROXY`**: 設定しないと、すべての要求がプロキシから来たように見えます。ログイン試行のレート制限（接続元IPごとに15分で10回）を全員で共有することになり、誰かがパスフレーズを10回間違えると、持ち主も締め出されます。前にあるプロキシの数（1台なら`1`）か、プロキシのアドレス（同じマシンなら`loopback`）を設定してください。`true`は使えません（起動時に`invalid IP address: true`で止まります）。仮に通っても、クライアントが送る`X-Forwarded-For`を何でも信じることになり、誰でも制限をすり抜けられます
