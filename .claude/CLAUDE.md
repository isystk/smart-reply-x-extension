# プロジェクト情報

X（旧Twitter）のリプライ業務を自動化するChrome拡張機能。返信ボタンのクリックを検知し、ツイート本文をGemini APIに送信して返信文を自動生成・挿入する。

## 技術スタック

- **言語**: JavaScript（ES2022+）
- **拡張機能仕様**: Chrome Manifest V3
- **外部API**: Google Gemini API（gemini-2.0-flash）
- **Chrome API**: `chrome.storage.local`, `chrome.runtime.sendMessage`
- **対象サイト**: x.com / twitter.com（SPA）

## ファイル構成

```
smart-reply-x-extension/
├── manifest.json   ← MV3マニフェスト（権限・スクリプト定義）
├── background.js   ← Service Worker（Gemini API呼び出し）
├── content.js      ← DOM操作・クリック検知・テキスト挿入
├── popup.html      ← 設定UI
└── popup.js        ← APIキー・プロンプトの保存・読み込み
```

## Language / 応答言語

常に日本語で応答する。技術用語・コード識別子は原文のまま。

## Communication Style

- 要点を簡潔に伝える
- 冗長な説明を避ける
- 絵文字は使用しない

## Working Style

- ソースコード内にコメントを書かない（例外: 極めて複雑なロジックの最小限の説明のみ）
- 新規ファイルの自動生成は行わない（必要最小限のファイルのみ）
- 変更は必要最小限に留める
- 過剰な抽象化・先取りした実装をしない

### NG行動

- `TypeScript` への変換提案（このプロジェクトは意図的に JavaScript で実装している）
- `npm` / `webpack` / `bundler` の導入提案（バンドル不要のシンプル構成を維持）
- ソースコードへの説明コメント追加
- 勝手な `README.md` や ドキュメントファイルの生成
- `eval()` や `innerHTML` を使った実装（CSP違反のため厳禁）

## アーキテクチャ原則

- **APIキーはService Workerのみで使用**: content.jsからGemini APIを直接叩かない。`chrome.runtime.sendMessage` 経由で background.js に委譲する。
- **DOM操作の堅牢性**: X（SPA）の動的レンダリングに対応するため、要素待機は `MutationObserver` ベースで実装する。ポーリングは使用しない。
- **テキスト挿入**: Reactの合成イベントと互換性のある `document.execCommand('insertText')` を使用する。

## Security

- `.env` ファイルや APIキーを絶対にコミットしない
- `chrome.storage.local` にのみAPIキーを保存する（`localStorage` 禁止）
- `eval()`, `new Function()`, `innerHTML` は使用禁止（MV3 CSP準拠）
- `host_permissions` は必要最小限のドメインのみに限定する

## Permissions

- `git push` は実行しない（ユーザーが手動で行う）
- `chrome.storage.local` への読み書きは許可
- Chrome拡張機能の再読み込みコマンドの案内は許可

## よく使う操作

```
# Chrome拡張機能の読み込み・更新
1. chrome://extensions/ を開く
2. デベロッパーモードをON
3. 「パッケージ化されていない拡張機能を読み込む」でディレクトリを選択
4. コード変更後は拡張機能カードの「更新」ボタンをクリック
```

## Additional Notes

- XのUIはReactベースのSPAのため、`data-testid` 属性でのセレクタが基本
- XのUIアップデートで `data-testid` が変わる可能性があるため、セレクタの変更に注意
- content.jsはX上のすべてのページで常に動作しているため、パフォーマンスへの影響を最小限にする
