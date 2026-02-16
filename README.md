# Lightning Out 2.0 with OAuth Authentication

Lightning Web Component (LWC) を外部のNode.js/Expressアプリケーションに埋め込むためのLightning Out 2.0実装です。

## 概要

このプロジェクトは、Salesforce Lightning Web Componentを外部Webアプリケーションに統合するためのデモアプリケーションです。OAuth 2.0認証フローを使用してSalesforceに接続し、Lightning Out 2.0フレームワークを通じてLWCコンポーネントを表示します。

## 主な機能

- ✅ OAuth 2.0 (PKCE対応) 認証フロー
- ✅ Lightning Out 2.0 統合
- ✅ サーバー間認証 (Client Credentials Flow)
- ✅ ユーザー名/パスワード認証 (フォールバック)
- ✅ Content Security Policy (CSP) 準拠
- ✅ リアルタイム認証状態管理
- ✅ 包括的なデバッグ機能
- ✅ **LWCとホスト間の双方向メッセージ通信**
- ✅ **Web Vitals警告フィルタリング機能**
- ✅ **Lightning Out対応イベントハンドリング**

## 必要環境

- Node.js 14.0 以上
- npm または yarn
- Salesforce Connected App (OAuth設定済み)
- Lightning Web Component (c-card-component)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数設定

`.env` ファイルを作成し、以下の値を設定：

```env
# Salesforce OAuth設定
SALESFORCE_CLIENT_ID=your_connected_app_client_id
SALESFORCE_CLIENT_SECRET=your_connected_app_client_secret
SALESFORCE_DOMAIN=your-domain.my.salesforce.com
SALESFORCE_LOGIN_URL=https://login.salesforce.com

# 認証フロー設定
SALESFORCE_AUTH_FLOW=password
SALESFORCE_USERNAME=your_salesforce_username
SALESFORCE_PASSWORD=your_password
SALESFORCE_SECURITY_TOKEN=your_security_token

# アプリケーション設定
PORT=3000
REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=your-session-secret

# Lightning Out設定
SALESFORCE_APP_ID=1UsHu000000oQTeKAM
SALESFORCE_COMPONENT_NAME=c-card-component
```

### 3. Salesforce Connected App設定

Connected Appで以下を設定：

- OAuth設定を有効化
- スコープ: `web`, `id`
- コールバックURL: `http://localhost:3000/auth/callback`
- Client Credentials Flowを有効化（推奨）

## 起動方法

```bash
node server.js
```

アプリケーションは http://localhost:3000 で利用できます。

## 認証フロー

### 1. 推奨: 動作保証版認証

メインの認証ボタン「⚡ Lightning Out 開始 (サーバー認証)」を使用：

1. サーバー間認証実行
2. 認証状態更新
3. UI切り替え (app-section表示)
4. Lightning Out初期化

### 2. OAuth認証

「🔐 OAuth認証」ボタンでブラウザベースのOAuth フローを実行：

1. `/auth` にリダイレクト
2. Salesforceログインページ
3. `/auth/callback` でトークン取得
4. Lightning Out初期化

## ファイル構成

```
LightnigOut2/
├── server.js                     # メインサーバーファイル
├── public/
│   └── index.html               # メインUI (Lightning Out 2.0対応)
├── force-app/main/default/lwc/
│   └── cardComponent/           # Lightning Web Component
│       ├── cardComponent.html   # LWCテンプレート
│       ├── cardComponent.js     # LWCロジック (双方向通信対応)
│       └── cardComponent.js-meta.xml
├── .env                         # 環境変数設定
└── README.md                   # このファイル
```

## API エンドポイント

### 認証関連

- `POST /auth/server` - サーバー間認証実行
- `GET /auth` - OAuth認証開始
- `GET /auth/callback` - OAuth コールバック処理

### システム関連

- `GET /api/health` - ヘルスチェック
- `GET /api/lightning-config` - Lightning Out設定取得

## デバッグ機能

### ステータス表示

リアルタイムでシステム状態を確認：

- 🟢 DOM: 準備完了
- 🟢 スクリプト: 読み込み完了
- 🟢 ボタン: 設定完了
- 🟢 認証: 成功

### デバッグボタン

- 🎯 実証済みトークンフロー - 成功パターンでテスト実行
- 🔍 認証状態確認 - 現在の認証状況を表示

### ログ機能

ブラウザコンソールとページ上の認証状態エリアでリアルタイムログを確認できます。

## トラブルシューティング

### Lightning Outスクリプトが読み込まれない

- SalesforceドメインのHTTPS URLを確認
- CORS設定を確認
- ネットワーク接続を確認

### 認証ボタンが反応しない

- ブラウザの開発者ツールでJavaScriptエラーを確認
- CSPエラーがないか確認
- イベントリスナーが正しく設定されているか確認

### app-sectionが表示されない

- 認証が完了しているか確認
- `switchToAppSection()` 関数が呼び出されているか確認
- DOM要素のID (`auth-section`, `app-section`) が正しいか確認

### Lightning Web Componentが表示されない

- Lightning Outスクリプトが読み込まれているか確認
- `frontdoor-url` 属性が正しく設定されているか確認
- Salesforceセッションが有効か確認

### LWCメッセージ通信が動作しない

- **症状**: ボタンクリック時にLWCでメッセージが表示されない
- **原因**: Lightning Out環境でのイベントリスナー設定問題
- **解決法**:
  ```javascript
  // ❌ 動作しない方法
  this.template.addEventListener('sendMessageToLWC', handler);

  // ✅ 正しい方法（Lightning Out対応）
  this.addEventListener('sendMessageToLWC', handler);
  ```

### Web Vitals警告 (`Unsupported WebVital metrics: [2]`)

- **症状**: コンソールに`O11Y Error: Unsupported WebVital metrics: [2]`が表示
- **原因**: Salesforce Lightning Out 2.0のパフォーマンス監視システムからの内部警告
- **影響**: **アプリケーションの動作には影響なし**
- **対策**:
  - 警告フィルタリング機能が自動的に適用される（index.html:90-110行目）
  - 必要に応じてデバッグ時は元の警告を確認可能
  - この警告は正常なLightning Out動作の一部

## セキュリティ

- Content Security Policy (CSP) 準拠
- HTTPS通信
- セッション管理
- トークンマスキング
- 外部スクリプト干渉防止

## 技術仕様

### 認証方式

1. **Client Credentials Flow** (推奨)
   - サーバー間通信
   - 自動トークン管理
   - セキュアな認証

2. **Username/Password Flow** (フォールバック)
   - 環境変数による認証
   - セキュリティトークン対応
   - Sandbox対応

3. **OAuth 2.0 PKCE**
   - ブラウザベース認証
   - セキュアなコード交換
   - リフレッシュトークン対応

### Lightning Out 2.0統合

- `frontdoor-url` による認証
- `lo.application.ready` イベント処理
- Lightning Web Componentとの双方向通信

## LWCメッセージ通信機能

### ホスト → LWC 通信

```javascript
// ホストページからLWCにメッセージを送信
const event = new CustomEvent('sendMessageToLWC', {
    detail: { message: '認証済みホストからのメッセージ' },
    bubbles: true,
    composed: true
});
lwcComponent.dispatchEvent(event);
```

### LWC → ホスト 通信

```javascript
// LWCからホストページにメッセージを送信
const event = new CustomEvent('lwcMessageToHost', {
    detail: { message: this.messageToHost },
    bubbles: true,
    composed: true
});
this.dispatchEvent(event);
```

### メッセージ表示

LWCコンポーネントには以下の機能があります：

- ✅ **初期化メッセージ表示** - コンポーネント読み込み完了の確認
- ✅ **タイムスタンプ付きメッセージ履歴** - 受信したメッセージの時系列表示
- ✅ **双方向通信テスト** - ホストとLWC間のリアルタイム通信
- ✅ **デバッグログ出力** - 開発者ツールでの詳細ログ確認

## デプロイメント

### Salesforce組織へのデプロイ

```bash
# LWCコンポーネントをSalesforce組織にデプロイ
sfdx project deploy start --source-dir force-app/main/default/lwc/cardComponent --target-org your-org-alias
```

## ライセンス

このプロジェクトはデモ用途のものです。商用利用の際は適切なライセンスを確認してください。

