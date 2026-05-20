const DEFAULT_PROMPT =
  '以下の投稿に対して、\n「同じ相場を見ているトレーダー」\nとして自然な返信を1件だけ作成してください。\n\n【最重要】\n- AIっぽい綺麗な文章は禁止\n- 「参考になります」「勉強になります」禁止\n- 解説しすぎない\n- 長文禁止\n- "TLを見ながら自然に反応した感じ" を出す\n- 少し雑なくらいで良い\n- 人間っぽい温度感を優先\n- 毎回違うテンション・文体にする\n- 投稿主を立てる\n- マウント禁止\n- 自分語り禁止\n- BOTっぽい絵文字連打禁止\n- 絵文字は自然な場合のみ0〜1個\n- 絵文字なしの返信も許可\n- 「なるほどですね」など丁寧すぎる口調禁止\n- 「〜と思います」など評論家口調禁止\n- 1〜3文\n- 20〜80文字程度\n- 改行は自然ならOK\n\n【返信スタイル】\n以下からランダムで1つ選ぶ：\n- 短く同調\n- 独り言っぽく\n- 板・OI・出来高への反応\n- 軽い警戒感\n- スキャルピング視点\n- マクロ視点\n- 温度感だけ\n- 一言だけ\n- 含みを持たせる\n- 少し疲れてるトレーダー感\n\n【相場用語（自然なら使って良い）】\nOI / 板 / 出来高 / ショート / ロング / ETF / CME / 現物 / クジラ / 清算 / ボラ\n\n【悪い例】\n「非常に参考になります」「勉強になります」「確かにその通りですね」「リスク管理が重要」「慎重に見る必要があります」\n\n【良い返信の雰囲気】\n「このOI、ちょっと嫌な増え方してる」\n「出来高弱いの気になる👀」\n「これ、去年も見た気がする」\n「ここでロング増えるの怖いな」\n「板薄いですね」\n「なんか嫌な静けさある」\n\n返信文のみを出力すること。余計な解説・前置き一切不要。\n\n【対象投稿】\n';

const apiKeyEl = document.getElementById('apiKey');
const promptEl = document.getElementById('customPrompt');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['apiKey', 'customPrompt'], ({ apiKey, customPrompt }) => {
  if (apiKey) apiKeyEl.value = apiKey;
  promptEl.value = customPrompt !== undefined ? customPrompt : DEFAULT_PROMPT;
});

saveBtn.addEventListener('click', () => {
  const apiKey = apiKeyEl.value.trim();
  const customPrompt = promptEl.value;

  if (!apiKey) {
    statusEl.textContent = 'APIキーを入力してください';
    statusEl.className = 'error';
    return;
  }

  chrome.storage.local.set({ apiKey, customPrompt }, () => {
    statusEl.textContent = '保存しました';
    statusEl.className = 'success';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = '';
    }, 2000);
  });
});
