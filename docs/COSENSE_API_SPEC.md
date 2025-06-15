# Scrapbox/Cosense API仕様書

このファイルは、Scrapbox/Cosense API の調査結果を記録し、今後の開発時に参照するためのドキュメントです。

## WebSocket API

### 概要
Scrapbox/Cosenseでは、ページの直接編集にWebSocket APIを使用します。REST APIは読み取り専用で、書き込み操作は提供されていません。

### 使用ライブラリ
- **@cosense/std**: WebSocket経由でのページ更新機能を提供
  - パッケージ: `npm:@jsr/cosense__std@^0.29.8`
  - JSRレジストリからインストール
- **@cosense/types**: TypeScript型定義
  - パッケージ: `npm:@jsr/cosense__types@^0.10.4`

### patch関数の仕様

#### 基本構文
```typescript
import { patch } from '@cosense/std/websocket';

const result = await patch(projectName, pageTitle, (lines) => {
  // 行の操作ロジック
  return modifiedLines;
});
```

#### パラメータ
- `projectName`: string - 対象プロジェクト名
- `pageTitle`: string - 編集対象ページのタイトル
- `callback`: (lines: Line[]) => Line[] - 行を操作するコールバック関数

#### Line型の構造
```typescript
interface Line {
  text: string;
  // その他のプロパティは@cosense/typesを参照
}
```

### 認証

#### Cookie認証
- `connect.sid`クッキーを使用
- WebSocket接続時に認証情報を渡す
- 環境変数`COSENSE_SID`から取得

### 行挿入ロジック

#### insert_lines実装方法
1. 現在のページ行を取得
2. 対象行を`findIndex()`で検索
3. 見つからない場合は末尾に追加
4. 新しいテキストを改行で分割
5. 配列の操作で行を挿入
6. 更新された行配列を返却

```typescript
const targetIndex = lines.findIndex(line => 
  line.text.includes(targetLineText)
);
const insertIndex = targetIndex >= 0 ? targetIndex + 1 : lines.length;
const newLines = text.split('\n').map(text => ({ text }));

return [
  ...lines.slice(0, insertIndex),
  ...newLines,
  ...lines.slice(insertIndex)
];
```

## REST API制約

### 読み取り専用エンドポイント
- `/api/pages/:projectName` - ページ一覧取得
- `/api/pages/:projectName/:pageTitle` - ページ詳細取得
- `/api/pages/:projectName/search/query` - ページ検索

### 書き込み不可
- ページの作成・更新・削除のREST APIは提供されていない
- ページ作成は専用URLを生成してブラウザで開く方式のみ

## 参考資料

### 実装例
- **yosider/cosense-mcp-server**: https://github.com/yosider/cosense-mcp-server
  - `src/tools/insertLinesTool.ts`にinsert_linesの実装例
  - WebSocket方式の実装パターン

### 技術情報
- **WebSocket書き込み方法**: https://scrapbox.io/villagepump/server-side%E3%81%8B%E3%82%89websocket%E3%82%92%E9%80%9A%E3%81%98%E3%81%A6scrapbox%E3%81%B8%E6%9B%B8%E3%81%8D%E8%BE%BC%E3%82%80
- **cosense-mcp-server**: https://scrapbox.io/villagepump/cosense-mcp-server

## 注意事項

### 利用規約
- WebSocket APIは内部APIのため、予告なく変更される可能性がある
- サービス利用規約に従った適切な使用を心がける

### エラーハンドリング
- WebSocket接続エラー
- 認証エラー
- ページが見つからない場合
- patch操作の失敗

### セキュリティ
- `connect.sid`クッキーの適切な管理
- 認証情報の漏洩防止

---

## 更新履歴
- 2025-06-15: 初版作成（insert_lines実装時の調査結果）