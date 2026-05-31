const DEFAULT_PROMPT =
  '以下の投稿に対して、\n「同じ相場を見ているトレーダー」\nとして自然な返信を1件だけ作成してください。\n\n【最重要】\n- AIっぽい綺麗な文章は禁止\n- 「参考になります」「勉強になります」禁止\n- 解説しすぎない\n- 長文禁止\n- "TLを見ながら自然に反応した感じ" を出す\n- 少し雑なくらいで良い\n- 人間っぽい温度感を優先\n- 毎回違うテンション・文体にする\n- 投稿主を立てる\n- マウント禁止\n- 自分語り禁止\n- BOTっぽい絵文字連打禁止\n- 絵文字は自然な場合のみ0〜1個\n- 絵文字なしの返信も許可\n- 「なるほどですね」など丁寧すぎる口調禁止\n- 「〜と思います」など評論家口調禁止\n- 相手の言語で回答する（相手が日本語なら日本語、英語なら英語）\n- 1〜3文\n- 20〜80文字程度\n- 改行は自然ならOK\n\n【返信スタイル】\n以下からランダムで1つ選ぶ：\n- 短く同調\n- 独り言っぽく\n- 板・OI・出来高への反応\n- 軽い警戒感\n- スキャルピング視点\n- マクロ視点\n- 温度感だけ\n- 一言だけ\n- 含みを持たせる\n- 少し疲れてるトレーダー感\n\n【相場用語（自然なら使って良い）】\nOI / 板 / 出来高 / ショート / ロング / ETF / CME / 現物 / クジラ / 清算 / ボラ\n\n【悪い例】\n「非常に参考になります」「勉強になります」「確かにその通りですね」「リスク管理が重要」「慎重に見る必要があります」\n\n【良い返信の雰囲気】\n「このOI、ちょっと嫌な増え方してる」\n「出来高弱いの気になる👀」\n「これ、去年も見た気がする」\n「ここでロング増えるの怖いな」\n「板薄いですね」\n「なんか嫌な静けさある」\n\n返信文のみを出力すること。余計な解説・前置き一切不要。\n\n【対象投稿】\n';

const TEXTAREA_SELECTORS = [
  '[data-testid="tweetTextarea_0"][contenteditable="true"]',
  '[data-testid="tweetTextarea_0"] [contenteditable="true"]',
];

const AI_BTN_CLASS = 'smart-reply-ai-btn';
let isGenerating = false;

function isVisible(el) {
  const { width, height } = el.getBoundingClientRect();
  return width > 0 && height > 0;
}

function getTweetText(toolBar) {
  const sources = [
    toolBar.closest('article'),
    toolBar.closest('[data-testid="tweet"]'),
    toolBar.closest('[role="dialog"]'),
  ];
  for (const src of sources) {
    const el = src?.querySelector('[data-testid="tweetText"]');
    if (el) return el.innerText.trim();
  }
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    const el = article.querySelector('[data-testid="tweetText"]');
    if (el && isVisible(el)) return el.innerText.trim();
  }
  return null;
}

function findEditorNearToolBar(toolBar) {
  let el = toolBar.parentElement;
  while (el && el !== document.body) {
    for (const sel of TEXTAREA_SELECTORS) {
      const editor = el.querySelector(sel);
      if (editor && isVisible(editor)) return editor;
    }
    el = el.parentElement;
  }
  return null;
}

function waitForVisibleElement(selectors, timeout = 5000) {
  return new Promise(resolve => {
    const check = () => {
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          if (isVisible(el)) return el;
        }
      }
      return null;
    };

    const found = check();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

async function insertTextIntoEditor(text, toolBar) {
  const editor = findEditorNearToolBar(toolBar) ?? await waitForVisibleElement(TEXTAREA_SELECTORS);
  if (!editor) return;

  editor.focus();
  document.execCommand('selectAll', false, null);

  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  editor.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  }));
}

function isExtensionAlive() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function createAiButton() {
  const btn = document.createElement('button');
  btn.className = AI_BTN_CLASS;
  btn.title = 'AIで返信を生成';
  btn.type = 'button';
  btn.style.cssText =
    'display:inline-flex;align-items:center;justify-content:center;' +
    'width:34px;height:34px;border:none;background:transparent;' +
    'cursor:pointer;border-radius:50%;padding:0;flex-shrink:0;' +
    'font-size:18px;line-height:1;transition:background 0.2s;';
  btn.textContent = '✨';
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(29,155,240,0.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
  return btn;
}

async function handleAiButtonClick(toolBar, btn) {
  if (isGenerating) return;
  if (!isExtensionAlive()) { toolBarObserver.disconnect(); return; }

  isGenerating = true;
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';

  try {
    const tweetText = getTweetText(toolBar);
    if (!tweetText) return;

    const { apiKey, customPrompt } = await chrome.storage.local.get(['apiKey', 'customPrompt']);
    if (!apiKey) return;

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_REPLY',
      tweetText,
      prompt: customPrompt || DEFAULT_PROMPT,
      apiKey,
    });

    if (response?.success) await insertTextIntoEditor(response.reply, toolBar);
  } catch {
    if (!isExtensionAlive()) toolBarObserver.disconnect();
  } finally {
    isGenerating = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}

function injectAiButton(toolBar) {
  if (toolBar.querySelector(`.${AI_BTN_CLASS}`)) return;

  const btn = createAiButton();
  if (isGenerating) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    handleAiButtonClick(toolBar, btn).catch(() => {});
  });
  toolBar.appendChild(btn);
}

const toolBarObserver = new MutationObserver(mutations => {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const toolBars = node.matches('[data-testid="toolBar"]')
        ? [node]
        : node.querySelectorAll('[data-testid="toolBar"]');
      for (const toolBar of toolBars) {
        if (isVisible(toolBar)) injectAiButton(toolBar);
      }
    }
  }
});

toolBarObserver.observe(document.body, { childList: true, subtree: true });
