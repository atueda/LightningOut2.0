# Salesforce Connected App 設定ガイド

## OAUTH_APPROVAL_ERROR_GENERIC エラーの解決方法

このエラーはConnected Appの設定が不完全な場合に発生します。以下の手順で修正してください。

## 1. Connected App の基本設定

### Salesforce Setup → App Manager
1. **Lightning Experience** で Salesforce にログイン
2. **Setup** (右上の歯車アイコン) をクリック
3. **Apps** → **App Manager** に移動
4. 既存のConnected Appを編集、または **New Connected App** を作成

### Connected App の設定

#### Basic Information
- **Connected App Name**: `Lightning Out Demo App`
- **API Name**: `Lightning_Out_Demo_App`
- **Contact Email**: あなたのメールアドレス

#### API (Enable OAuth Settings)
- ✅ **Enable OAuth Settings** をチェック
- **Callback URL**: `http://localhost:3000/auth/callback` (完全一致必須)

#### Selected OAuth Scopes
以下のスコープを **Selected OAuth Scopes** に追加：
- `api` (Access the user's data via the Web API)
- `refresh_token` (Refresh the access token)
- `web` (Access basic information about the user's organization)

## 2. PKCE設定 (重要!)

#### OAuth Policies セクション
- ✅ **Require Proof Key for Code Exchange (PKCE) Extension for Public Clients** をチェック
  - これが最も重要な設定です

#### Refresh Token Policy
- **Refresh token is valid until revoked** を選択

#### IP Relaxation
- **IP Relaxation**: `Relax IP restrictions` を選択 (開発環境用)

## 3. その他の重要設定

#### Start URL (Optional)
- 空白のままでOK

#### Custom Connected App Handler
- 空白のままでOK

#### Canvas App URL
- 空白のままでOK

## 4. 保存後の待機時間

Connected App の設定を変更後は **2〜10分** 待つ必要があります。
Salesforceの内部での設定反映に時間がかかります。

## 5. 設定確認用チェックリスト

### 必須チェック項目
- [ ] Enable OAuth Settings が有効
- [ ] Callback URL が `http://localhost:3000/auth/callback` と完全一致
- [ ] api スコープが選択されている
- [ ] refresh_token スコープが選択されている
- [ ] **Require PKCE** が有効
- [ ] IP Relaxation が設定されている
- [ ] 設定変更から5分以上経過している

## 6. 環境変数の確認

`.env` ファイルの以下の値を確認：
```
SALESFORCE_CLIENT_ID=<Connected App の Consumer Key>
SALESFORCE_CLIENT_SECRET=<Connected App の Consumer Secret>
REDIRECT_URI=http://localhost:3000/auth/callback
```

## 7. トラブルシューティング

### エラーが続く場合
1. Connected App を一度削除して新規作成
2. 新しいSalesforce組織での再テスト
3. Lightning Experience が有効か確認
4. ユーザープロファイルの権限確認

### ログの確認
サーバーログで以下を確認：
- PKCE parameters が生成されているか
- OAuth URL に code_challenge が含まれているか
- Callback でエラーの詳細が表示されているか