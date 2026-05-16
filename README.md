# smart-reply-x-extension

![GitHub issues](https://img.shields.io/github/issues/isystk/smart-reply-x-extension)
![GitHub forks](https://img.shields.io/github/forks/isystk/smart-reply-x-extension)
![GitHub stars](https://img.shields.io/github/stars/isystk/smart-reply-x-extension)

## 📗 プロジェクトの概要

X（旧Twitter）上でのコミュニケーションを円滑にするためのブラウザ拡張機能です。ユーザーの入力や投稿内容に基づいたスマートな返信をサポートします。

### 対象としている方

- Xでの返信を効率化したい方
- ブラウザ拡張機能の開発に興味がある方

### 利用している技術

#### インフラ / 実行環境
- **Google Chrome (Extension API)**

#### 使用しているライブラリ
- **Backend**: JavaScript (Background Service Worker)
- **Frontend**: JavaScript, HTML, CSS
- **Design/Tool**: Manifest V3

```mermaid
graph TD
    A[ユーザー] --> B[ポップアップ UI]
    B --> C[Content Script]
    C --> D[X ウェブサイト]
    C <-> E[Background Script]
```

## 📦 ディレクトリ構造

```text
.
./background.js      # バックグラウンド処理（サービスワーカー）
./content.js         # Xのページ上で動作するスクリプト
./manifest.json      # 拡張機能の設定ファイル
./popup.html         # 拡張機能のポップアップUI
./popup.js           # ポップアップのロジック
```

## 🔧 開発環境の構築

### 前提条件

* Google Chrome ブラウザ

### セットアップ手順

1. **リポジトリのクローン**
```bash
git clone git@isystk-github.com:isystk/smart-reply-x-extension
cd smart-reply-x-extension
```

2. **初期設定・動作確認**
1. Chromeブラウザで `chrome://extensions/` を開きます。
2. 右上の「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックします。
4. クローンしたプロジェクトのディレクトリを選択します。

## 👀 Author

[isystk](https://github.com/isystk)
