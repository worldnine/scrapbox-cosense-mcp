# Scrapbox REST API 仕様書

> **重要**: これは内部APIであり、予告なく変更される可能性があります。本仕様書は参考情報として提供されています。

## 目次

1. [概要](#概要)
2. [共通仕様](#共通仕様)
3. [エンドポイント一覧](#エンドポイント一覧)
   - [ページ関連 API](#ページ関連-api)
   - [検索 API](#検索-api)
   - [プロジェクト関連 API](#プロジェクト関連-api)
   - [ユーザー関連 API](#ユーザー関連-api)

## 概要
このドキュメントはScrapbox REST APIの仕様を定義したものです。

## 共通仕様
### ベースURL
```
https://scrapbox.io/api
```

## エンドポイント一覧

### ページ関連 API

#### ページ一覧の取得
`GET /pages/:projectname`

プロジェクト内のページ情報を取得します。本文は取得できませんが、冒頭5行が`descriptions`として取得されます。

##### クエリパラメータ
| パラメータ | 型 | 必須 | 説明 |
|------------|-----|------|------|
| limit | number | 任意 | 取得するページ情報の最大数（1-1000） | skip | number | 任意 | 何番目のページから取得するかを指定 |
| sort | string | 任意 | ソート方法（以下のいずれか）:<br>- `updated`: 更新日時<br>- `created`: 作成日時<br>- `accessed`: アクセス日時<br>- `linked`: リンク数<br>- `views`: 閲覧数<br>- `title`: タイトル<br>- `updatedbyMe`: 自分の更新（`lastAccessed`が追加されます） |

##### レスポンス
```typescript
interface ProjectResponse {
  projectName: string;     // データ取得先のプロジェクト名
  skip: number;           // パラメータに渡したskipと同じ
  limit: number;          // パラメータに渡したlimitと同じ
  count: number;          // プロジェクトの全ページ数（中身のないページを除く）
  pages: {
    id: string;
    title: string;
    image: string | null;
    descriptions: string[];  // 冒頭5行
    user: {
      id: string;
    };
    pin: number;           // ピン留めされていない場合は0
    views: number;
    linked: number;
    commitId: string;
    created: number;
    updated: number;
    accessed: number;
    lastAccessed?: number;  // sort=updatedbyMeの場合のみ
    snapshotCreated: number | null;
    pageRank: number;
  }[];
}

```
#### ページ情報の取得
`GET /pages/:projectname/:pagetitle`

特定のページの詳細情報を取得します。

##### クエリパラメータ
| パラメータ | 型 | 必須 | 説明 |
|------------|-----|------|------|
| followRename | boolean | 任意 | ページが存在しない場合、アクセス履歴から変更先のタイトルを探してリダイレクトする機能を有効にします |
| projects | string[] | 任意 | External linksを有効にするプロジェクトIDのリスト。複数指定可能です。※ログインが必要です |
| filterType | string | 任意 | フィルタータイプ（例: "icon"） |
| filterValue | string | 任意 | フィルター値 |

##### 制限事項
- `projects`パラメータは上限はありませんが、URLの長さ制限により約200個程度が実用的な上限となります
- 制限を超えた場合、`414 URI Too Long`エラーが発生します

##### レスポンス
```typescript
interface PageResponse {
  // 基本情報
  id: string;                    // ページのid
  title: string;                 // ページのタイトル
  image: string;                 // ページのサムネイル画像
  descriptions: string[];        // ページのサムネイル本文（最大5行）
  
  // ステータス情報
  pin: 0 | 1;                   // ピン留め状態（0: なし、1: あり）
  views: number;                 // ページの閲覧回数
  linked: number;               // 被リンク数
  commitId?: string;            // 最新の編集コミットid
  
  // 日時情報
  created: number;              // ページの作成日時
  updated: number;              // ページの最終更新日時
  accessed: number;             // 最終アクセス日時
  lastAccessed: number | null;  // APIを実行したユーザーの最終アクセス日時
  
  // スナップショット情報
  snapshotCreated: number | null; // Page history最終生成日時
  snapshotCount: number;        // 生成されたPage history数
  
  // その他のメタデータ
  pageRank: number;             // ページランク
  persistent: boolean;          // ページの永続性フラグ
  
  // コンテンツ
  lines: {                      // 本文（行単位）
    id: string;                 // 行のid
    text: string;               // 行のテキスト
    userId: string;             // 最終編集者のid
    created: number;            // 行の作成日時
    updated: number;            // 行の最終更新日時
  }[];
  
  // 関連情報
  links: string[];              // ページ内のリンク
  icons: string[];              // ページアイコン
  files: string[];              // アップロードされたファイルへのリンク
  
  // 関連ページ情報
  relatedPages: {
    links1hop: {               // 直接リンクされているページ
      id: string;              
      title: string;
      titleLc: string;
      image: string;
      descriptions: string[];
      linksLc: string[];
      linked: number;
      updated: number;
      accessed: number;
    }[];
    links2hop: {               // 間接的にリンクされているページ
      id: string;
      title: string;
      titleLc: string;
      image: string;
      descriptions: string[];
      linksLc: string[];
      linked: number;
      updated: number;
      accessed: number;
    }[];
    hasBackLinksOrIcons: boolean;
  };
  
  // ユーザー情報
  user: {                      // 最終編集者
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
  collaborators: {             // その他の編集者
    id: string;
    name: string;
    displayName: string;
    photo: string;
  }[];
}
```

## URLスキーマ

### ページ作成/編集

#### 本文付きページ作成
```
https://scrapbox.io/プロジェクト名/ページタイトル?body=本文
```

指定したプロジェクトに、事前に本文が入力された状態でページを作成します。

##### 特徴
- 新規ページの場合：指定した本文で作成
- 既存ページの場合：指定した本文を末尾に追記
- Scrapboxの記法（引用、リンク等のブラケティング）が使用可能
- 改行文字（`\n`）が使用可能

##### 使用上の注意
- `body`パラメータの値はURLエンコードが必要
- 長文の場合はURLの長さ制限に注意

##### 使用例
```
# 基本的な使用例
https://scrapbox.io/myproject/新規ページ?body=最初の行%0A次の行

# Scrapbox記法を含む例
https://scrapbox.io/myproject/リンク例?body=[リンク]を含む本文%0A引用:%20引用文
```

#### プレーンテキストの取得
`GET /pages/:projectname/:pagetitle/text`

指定したページの内容をプレーンテキストとして取得します。Scrapboxの記法（ブラケットなど）はそのまま保持されます。

### 検索 API

#### タイトル検索
`GET /pages/:projectname/search/titles`

プロジェクト内のページ一覧とリンク情報を取得します。

##### 特記事項
- 作成日時が古い順に1000件ずつ取得できます
- ページネーションは応答ヘッダの`X-Following-Id`を使用します

##### ページネーション
- 続きのデータを取得する場合: `GET /pages/:projectname/search/titles?followingId=xxxx`
  - `xxxx`は前回のレスポンスヘッダ`X-Following-Id`の値

##### レスポンス
```typescript
type SearchTitlesResponse = {
  id: string;      // ページid
  title: string;   // ページタイトル
  hasIcon: boolean; // 画像の存在フラグ
  updated: number; // ページの更新日時
  links: string[]; // ページ内のリンク
}[];
```

#### 全文検索
`GET /pages/:projectname/search/query`

プロジェクト内のページを全文検索します。

##### クエリパラメータ
| パラメータ | 型 | 必須 | 説明 |
|------------|-----|------|------|
| q | string | 必須 | 検索語句 |

##### 検索構文
- 複数語句: スペース区切りでAND検索
- 除外検索: 語句の先頭に`-`を付加
- フレーズ検索: `""`で囲む（空白を含む検索に使用）

##### 使用例
```
/api/pages/scrapboxlab/search/query?q=scrapbox%20-java%20gyazo
```

##### レスポンス
```typescript
type SearchQueryResponse = {
  projectName: string;   // データ取得先のプロジェクト名
  searchQuery: string;   // 検索語句
  query: {
    words: string[];    // AND検索に使用された語句
    excludes: string[]; // NOT検索に使用された語句
  };
  limit: number;        // 検索件数の上限
  count: number;        // 検索件数
  existsExactTitleMatch: boolean;
  backend: 'elasticsearch';
  pages: {
    id: string;
    title: string;
    image: string;     // 画像なしの場合は空文字
    words: string[];
    lines: string[];   // 検索語句にマッチした行
                      // タイトル行のみマッチの場合は次の行のみ
  }[];
}
```