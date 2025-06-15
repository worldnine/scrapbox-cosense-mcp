# Scrapbox REST API 仕様書

## 目次

- [Scrapbox REST API 仕様書](#scrapbox-rest-api-仕様書)
  - [目次](#目次)
  - [1. 概要](#1-概要)
  - [2. 基本仕様](#2-基本仕様)
    - [2.1 ベースURL](#21-ベースurl)
  - [3. APIリファレンス](#3-apiリファレンス)
    - [3.1 ページ関連 API](#31-ページ関連-api)
      - [3.1.1 ページ一覧の取得](#311-ページ一覧の取得)
        - [クエリパラメーター](#クエリパラメーター)
        - [レスポンス](#レスポンス)
      - [3.1.2 ページ情報の取得](#312-ページ情報の取得)
        - [クエリパラメーター](#クエリパラメーター-1)
        - [制限事項](#制限事項)
        - [レスポンス](#レスポンス-1)
    - [3.2 検索 API](#32-検索-api)
      - [3.2.1 タイトル検索](#321-タイトル検索)
        - [特記事項](#特記事項)
        - [ページネーション](#ページネーション)
        - [レスポンス](#レスポンス-2)
      - [3.2.2 全文検索](#322-全文検索)
        - [クエリパラメーター](#クエリパラメーター-2)
        - [検索構文](#検索構文)
        - [使用例](#使用例)
        - [レスポンス](#レスポンス-3)
  - [4. URLリファレンス](#4-urlリファレンス)
    - [4.1 ページ作成/編集](#41-ページ作成編集)
      - [本文付きページ作成](#本文付きページ作成)
        - [特徴](#特徴)
        - [使用上の注意](#使用上の注意)
        - [使用例](#使用例-1)
      - [プレーンテキストの取得](#プレーンテキストの取得)


> **重要**: この仕様書はインターネット上で有志が公開されている情報の断片を寄せ集めて作成されたものであり、正確性を保証するものではないので注意すること。

## 1. 概要

このドキュメントはScrapbox REST APIの仕様を定義したものです。

## 2. 基本仕様

### 2.1 ベースURL

```txt
https://scrapbox.io/api
```

## 3. APIリファレンス

### 3.1 ページ関連 API

#### 3.1.1 ページ一覧の取得

`GET /pages/:projectname`

プロジェクト内のページ情報を取得します。本文は取得できませんが、冒頭5行が`descriptions`として取得されます。

##### クエリパラメーター

| パラメーター | 型 | 必須 | 説明 |
|------------|-----|------|------|
| limit | number | 任意 | 取得するページ情報の最大数（1-1000） |
| skip | number | 任意 | 何番目のページから取得するかを指定 |
| sort | string | 任意 | ソート方法（以下のいずれか）:<br>- `updated`: 更新日時<br>- `created`: 作成日時<br>- `accessed`: アクセス日時<br>- `linked`: リンク数<br>- `views`: 閲覧数<br>- `title`: タイトル |

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
    snapshotCreated: number | null;
    pageRank: number;
  }[];
}
```

#### 3.1.2 ページ情報の取得

`GET /pages/:projectname/:pagetitle`

特定のページの詳細情報を取得します。

##### クエリパラメーター

| パラメーター | 型 | 必須 | 説明 |
|------------|-----|------|------|
| followRename | boolean | 任意 | ページが存在しない場合、アクセス履歴から変更先のタイトルを探してリダイレクトする機能を有効にします |
| projects | string[] | 任意 | External linksを有効にするプロジェクトIDのリスト。複数指定可能です。※ログインが必要です |
| filterType | string | 任意 | フィルタータイプ（例: "icon"） |
| filterValue | string | 任意 | フィルター値 |

##### 制限事項

- `projects`パラメーターは上限はありませんが、URLの長さ制限により約200個程度が実用的な上限となります
- 制限を超えた場合、`414 URI Too Long`エラーが発生します

##### レスポンス

```typescript
interface PageResponse {
  id: string;                    // ページのid
  title: string;                 // ページのタイトル
  image: string;                 // ページのサムネイル画像
  descriptions: string[];        // ページのサムネイル本文（最大5行）
  pin: 0 | 1;                   // ピン留め状態（0: なし、1: あり）
  views: number;                 // ページの閲覧回数
  linked: number;               // 被リンク数
  commitId?: string;            // 最新の編集コミットid
  created: number;              // ページの作成日時
  updated: number;              // ページの最終更新日時
  accessed: number;             // 最終アクセス日時
  lastAccessed: number | null;  // APIを実行したユーザーの最終アクセス日時
  snapshotCreated: number | null; // Page history最終生成日時
  snapshotCount: number;        // 生成されたPage history数
  pageRank: number;             // ページランク
  persistent: boolean;          // ページの永続性フラグ
  lines: {                      // 本文（行単位）
    id: string;                 // 行のid
    text: string;               // 行のテキスト
    userId: string;             // 最終編集者のid
    created: number;            // 行の作成日時
    updated: number;            // 行の最終更新日時
  }[];
  links: string[];              // ページ内のリンク
  icons: string[];              // ページアイコン
  files: string[];              // アップロードされたファイルへのリンク
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

### 3.2 検索 API

#### 3.2.1 タイトル検索

`GET /pages/:projectname/search/titles`

プロジェクト内のページ一覧とリンク情報を取得します。

##### 特記事項

- 作成日時が古い順に1000件ずつ取得できます
- ページネーションは応答ヘッダーの`X-Following-Id`を使用します

##### ページネーション

- 続きのデータを取得する場合: `GET /pages/:projectname/search/titles?followingId=xxxx`
  - `xxxx`は前回のレスポンスヘッダー`X-Following-Id`の値

##### レスポンス

```typescript
type SearchTitlesResponse = {
  id: string;      // ページid
  title: string;   // ページタイトル
  hasIcon: boolean; // 画像の存在フラグ
  updated: number; // ページの更新日時
  links: string[]; // ページ内のリンク
  image: string | null; // ページの画像
  linksLc: string[]; // 小文字に変換したリンク一覧
}[];
```

#### 3.2.2 全文検索

`GET /pages/:projectname/search/query`

プロジェクト内のページを全文検索します。おいう

##### クエリパラメーター

| パラメーター | 型 | 必須 | 説明 |
|------------|-----|------|------|
| q | string | 必須 | 検索語句 |

##### 検索構文

- 複数語句: スペース区切りでAND検索
- 除外検索: 語句の先頭に`-`を付加
- フレーズ検索: `""`で囲む（空白を含む検索に使用）

##### 使用例

```text
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

## 4. URLリファレンス

### 4.1 ページ作成/編集

#### 本文付きページ作成

```text
https://scrapbox.io/プロジェクト名/ページタイトル?body=本文
```

指定したプロジェクトに、事前に本文が入力された状態でページを作成します。

##### 特徴

- 新規ページの場合：指定した本文で作成
- 既存ページの場合：指定した本文を末尾に追記
- Scrapboxの記法（引用、リンク等のブラケティング）が使用可能
- 改行文字（`\n`）が使用可能

##### 使用上の注意

- `body`パラメーターの値はURLエンコードが必要
- 長文の場合はURLの長さ制限に注意

##### 使用例

```markdown
# 基本的な使用例
https://scrapbox.io/myproject/新規ページ?body=最初の行%0A次の行

# Scrapbox記法を含む例
https://scrapbox.io/myproject/リンク例?body=[リンク]を含む本文%0A引用:%20引用文
```

#### プレーンテキストの取得

`GET /pages/:projectname/:pagetitle/text`

指定したページの内容をプレーンテキストとして取得します。Scrapboxの記法（ブラケットなど）はそのまま保持されます。
