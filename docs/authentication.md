# How to Get COSENSE_SID Cookie

For accessing private Scrapbox projects, you need to obtain the `connect.sid` cookie from your browser.

## Steps

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

## Important Notes

- Keep your `connect.sid` value secure — treat it like a password
- The cookie may expire; obtain a new one if authentication fails
- This cookie provides access to your private projects

---

# COSENSE_SID Cookieの取得方法

プライベートなScrapboxプロジェクトにアクセスするには、ブラウザから `connect.sid` Cookieを取得する必要があります。

## 手順

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

## 注意事項

- `connect.sid` の値はパスワードと同様に安全に管理してください
- Cookieは期限切れになることがあります。認証エラーが発生したら新しいCookieを取得してください
