const DEFAULT_PROMPT =
  '以下の投稿に対して、プロのBTCスキャルパーとしての視点を交えた、具体的かつ熱量のある1〜2文の返信を1つだけ出力してください。絵文字を1〜2個自然に含めること。「参考になります」「勉強になります」などの定型句は厳禁。余計な挨拶や解説は一切省き、返信文のみを出力すること。\n\n【対象の投稿】\n';

const TEXTAREA_SELECTORS = [
  '[data-testid="tweetTextarea_0"][contenteditable="true"]',
  '[data-testid="tweetTextarea_0"] [contenteditable="true"]',
  '[data-testid="tweetTextarea_0"]',
];

const AI_BTN_ID = 'smart-reply-ai-btn';

function getTweetText(toolBar) {
  const article = toolBar.closest('article') ?? toolBar.closest('[data-testid="tweet"]');
  if (article) {
    const el = article.querySelector('[data-testid="tweetText"]');
    if (el) return el.innerText.trim();
  }

  const allArticles = document.querySelectorAll('article[data-testid="tweet"]');
  for (const a of allArticles) {
    const el = a.querySelector('[data-testid="tweetText"]');
    if (el) return el.innerText.trim();
  }

  return null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function waitForVisibleElement(selectors, timeout = 8000) {
  return new Promise(resolve => {
    const check = () => {
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (isVisible(el)) return el;
        }
      }
      return null;
    };

    const found = check();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

async function insertTextIntoEditor(text) {
  const editor = await waitForVisibleElement(TEXTAREA_SELECTORS);
  if (!editor) return;

  editor.click();
  editor.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);

  document.execCommand('insertText', false, text);
}

function createAiButton() {
  const btn = document.createElement('button');
  btn.id = AI_BTN_ID;
  btn.title = 'AIで返信を生成';
  btn.setAttribute('type', 'button');
  btn.style.cssText =
    'display:inline-flex;align-items:center;justify-content:center;' +
    'width:34px;height:34px;border:none;background:transparent;' +
    'cursor:pointer;border-radius:50%;padding:0;flex-shrink:0;' +
    'font-size:18px;line-height:1;transition:background 0.2s;';

  btn.textContent = '✨';

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(29,155,240,0.1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });

  return btn;
}

async function handleAiButtonClick(toolBar) {
  const btn = document.getElementById(AI_BTN_ID);
  if (btn) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }

  try {
    const tweetText = getTweetText(toolBar);
    if (!tweetText) return;

    const { apiKey, customPrompt } = await chrome.storage.local.get(['apiKey', 'customPrompt']);
    if (!apiKey) return;

    const prompt = customPrompt || DEFAULT_PROMPT;

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_REPLY',
      tweetText,
      prompt,
      apiKey,
    });

    if (response?.success) {
      await insertTextIntoEditor(response.reply);
    }
  } finally {
    if (btn) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  }
}

function injectAiButton(toolBar) {
  if (toolBar.querySelector(`#${AI_BTN_ID}`)) return;

  const btn = createAiButton();
  btn.addEventListener('click', e => {
    e.stopPropagation();
    handleAiButtonClick(toolBar);
  });

  toolBar.appendChild(btn);
}

const toolBarObserver = new MutationObserver(() => {
  const toolBars = document.querySelectorAll('[data-testid="toolBar"]');
  for (const toolBar of toolBars) {
    if (isVisible(toolBar)) {
      injectAiButton(toolBar);
    }
  }
});

toolBarObserver.observe(document.body, { childList: true, subtree: true });
