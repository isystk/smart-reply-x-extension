const TEXTAREA_SELECTORS = [
  '[data-testid="tweetTextarea_0"][contenteditable="true"]',
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

function getEditorText(editor) {
  const text = editor.innerText.replace(/\u200b/g, '').replace(/\n+$/, '');
  return text.trim() ? text : '';
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

function moveCaretToEnd(editor) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectEditorContents(editor) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
}

function buildPrompt(promptTemplate, tweetText, draftText) {
  if (!draftText) return promptTemplate + tweetText;

  return `${promptTemplate}${tweetText}\n\n**【入力途中の返信】**\n${draftText}\n\n**【依頼】** この入力途中の文を自然に補完してください。出力は続きだけにして、すでに入力済みの文は繰り返さないでください。`;
}

function normalizeContinuation(reply, draftText) {
  const text = reply.trim();
  const draft = draftText.trim();

  if (!draft) return text;
  if (text === draft) return '';
  if (text.startsWith(draft)) {
    return text.slice(draft.length).replace(/^\s+/, '');
  }

  return text;
}

function setEditorText(editor, text) {
  editor.focus();
  selectEditorContents(editor);
  document.execCommand('delete', false, null);
  selectEditorContents(editor);
  document.execCommand('insertText', false, text);
  moveCaretToEnd(editor);
}

async function insertTextIntoEditor(text, toolBar, editor = null) {
  const targetEditor = editor ?? findEditorNearToolBar(toolBar) ?? await waitForVisibleElement(TEXTAREA_SELECTORS);
  if (!targetEditor) return;

  setEditorText(targetEditor, text);
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

    const editor = findEditorNearToolBar(toolBar) ?? await waitForVisibleElement(TEXTAREA_SELECTORS);
    const draftText = editor ? getEditorText(editor) : '';
    const { apiKey, customPrompt } = await chrome.storage.local.get(['apiKey', 'customPrompt']);
    if (!apiKey) return;

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_REPLY',
      tweetText,
      prompt: buildPrompt(customPrompt || X_REPLY_DEFAULT_PROMPT, tweetText, draftText),
      apiKey,
    });

    if (response?.success) {
      const reply = normalizeContinuation(response.reply, draftText);
      if (!reply && !draftText) return;
      await insertTextIntoEditor(draftText ? draftText + reply : reply, toolBar, editor);
    }
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
