const TEXTAREA_SELECTORS = [
  '[data-testid="tweetTextarea_0"][contenteditable="true"]',
];

const AI_BTN_CLASS = 'smart-reply-ai-btn';
const QUOTE_AI_BTN_CLASS = 'smart-reply-quote-btn';
const QUOTE_AI_BTN_WRAPPER_CLASS = 'smart-reply-quote-btn-wrapper';
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

function getQuotedTweetText(attachmentsRoot) {
  const el = attachmentsRoot.querySelector('[data-testid="tweetText"]');
  return el?.innerText.trim() || null;
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

function findEditorNearAnchor(anchor) {
  return findEditorNearToolBar(anchor);
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

function buildQuotePrompt(promptTemplate, tweetText, draftText) {
  if (!draftText) return promptTemplate + tweetText;

  return `${promptTemplate}${tweetText}\n\n**【入力途中のコメント】**\n${draftText}\n\n**【依頼】** この入力途中の文を自然に補完してください。出力は続きだけにして、すでに入力済みの文は繰り返さないでください。`;
}

function normalizeContinuation(reply, draftText) {
  let text = reply.trim();
  const draft = draftText.trim();

  if (!draft) return text;
  if (text === draft) return '';

  while (text.startsWith(draft)) {
    text = text.slice(draft.length).replace(/^\s+/, '');
  }

  return text;
}

function setEditorText(editor, text) {
  editor.focus();
  const normalized = text.trim();
  document.execCommand('selectAll', false, null);
  const dt = new DataTransfer();
  dt.setData('text/plain', normalized);
  editor.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  }));
  moveCaretToEnd(editor);
}

function appendTextToEditor(editor, text) {
  editor.focus();
  moveCaretToEnd(editor);
  document.execCommand('insertText', false, text);
}

async function insertTextIntoEditor(text, toolBar, editor = null, append = false) {
  const targetEditor = editor ?? findEditorNearToolBar(toolBar) ?? await waitForVisibleElement(TEXTAREA_SELECTORS);
  if (!targetEditor) return;

  if (append) {
    appendTextToEditor(targetEditor, text);
  } else {
    setEditorText(targetEditor, text);
  }
}

function isExtensionAlive() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function createAiButton(className, title) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.type = 'button';
  btn.style.cssText =
    'display:inline-flex;align-items:center;justify-content:center;' +
    'width:34px;height:34px;border:none;background:transparent;' +
    'cursor:pointer;border-radius:50%;padding:0;flex-shrink:0;' +
    'pointer-events:auto;position:relative;z-index:2;' +
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
      await insertTextIntoEditor(reply, toolBar, editor, !!draftText);
    }
  } catch {
    if (!isExtensionAlive()) toolBarObserver.disconnect();
  } finally {
    isGenerating = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}

async function handleQuoteButtonClick(attachmentsRoot, btn) {
  if (isGenerating) return;
  if (!isExtensionAlive()) { toolBarObserver.disconnect(); return; }

  isGenerating = true;
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';

  try {
    const tweetText = getQuotedTweetText(attachmentsRoot);
    if (!tweetText) return;

    const editor = findEditorNearAnchor(attachmentsRoot) ?? await waitForVisibleElement(TEXTAREA_SELECTORS);
    const draftText = editor ? getEditorText(editor) : '';
    const { apiKey, customPrompt, customQuotePrompt } = await chrome.storage.local.get(['apiKey', 'customPrompt', 'customQuotePrompt']);
    if (!apiKey) return;

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_REPLY',
      tweetText,
      prompt: buildQuotePrompt(customQuotePrompt || customPrompt || X_QUOTE_DEFAULT_PROMPT, tweetText, draftText),
      apiKey,
    });

    if (response?.success) {
      const reply = normalizeContinuation(response.reply, draftText);
      if (!reply && !draftText) return;
      await insertTextIntoEditor(reply, attachmentsRoot, editor, !!draftText);
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
  if (getQuoteAttachmentsRoot(toolBar)) return;
  if (toolBar.querySelector(`.${AI_BTN_CLASS}`)) return;

  const btn = createAiButton(AI_BTN_CLASS, 'AIで返信を生成');
  if (isGenerating) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    handleAiButtonClick(toolBar, btn).catch(() => {});
  });
  btn.addEventListener('pointerdown', e => {
    e.stopPropagation();
  });
  toolBar.appendChild(btn);
}

function getQuoteComposerRoot(anchor) {
  let el = anchor;
  while (el && el !== document.body) {
    const attachmentsRoot = el.querySelector('[data-testid="attachments"]');
    const editor = el.querySelector('[data-testid="tweetTextarea_0"][contenteditable="true"]');
    const toolBar = el.querySelector('[data-testid="toolBar"]');
    const tweetText = attachmentsRoot?.querySelector('[data-testid="tweetText"]');

    if (attachmentsRoot && editor && toolBar && tweetText && isVisible(editor) && isVisible(tweetText)) {
      return el;
    }

    el = el.parentElement;
  }

  return null;
}

function isQuoteComposer(attachmentsRoot) {
  return !!getQuoteComposerRoot(attachmentsRoot);
}

function getQuoteAttachmentsRoot(anchor) {
  const composerRoot = getQuoteComposerRoot(anchor);
  return composerRoot?.querySelector('[data-testid="attachments"]') ?? null;
}

function getQuoteButtonHost(toolBar) {
  return toolBar.querySelector('[data-testid="ScrollSnap-List"]')
    ?? toolBar.querySelector('nav')
    ?? toolBar;
}

function injectQuoteButton(attachmentsRoot) {
  const composerRoot = getQuoteComposerRoot(attachmentsRoot);
  if (!composerRoot) return;

  const toolBar = composerRoot.querySelector('[data-testid="toolBar"]');
  if (!toolBar || !isVisible(toolBar)) return;
  toolBar.querySelector(`.${AI_BTN_CLASS}`)?.remove();
  if (toolBar.querySelector(`.${QUOTE_AI_BTN_CLASS}`)) return;

  const host = getQuoteButtonHost(toolBar);
  const wrapper = document.createElement('div');
  wrapper.className = QUOTE_AI_BTN_WRAPPER_CLASS;
  wrapper.setAttribute('role', 'presentation');
  wrapper.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;z-index:2147483647;';

  const btn = createAiButton(QUOTE_AI_BTN_CLASS, 'AIで引用コメントを生成');
  btn.style.zIndex = '2147483647';
  if (isGenerating) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }

  const startGeneration = e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    handleQuoteButtonClick(attachmentsRoot, btn).catch(() => {});
  };
  const stopOnly = e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  btn.addEventListener('pointerdown', startGeneration, true);
  btn.addEventListener('mousedown', startGeneration, true);
  btn.addEventListener('click', stopOnly, true);
  wrapper.addEventListener('pointerdown', startGeneration, true);
  wrapper.addEventListener('mousedown', startGeneration, true);
  wrapper.addEventListener('click', stopOnly, true);
  wrapper.appendChild(btn);
  host.appendChild(wrapper);
}

const toolBarObserver = new MutationObserver(mutations => {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const toolBars = node.matches('[data-testid="toolBar"]')
        ? [node]
        : node.querySelectorAll('[data-testid="toolBar"]');
      for (const toolBar of toolBars) {
        if (!isVisible(toolBar)) continue;

        const attachmentsRoot = getQuoteAttachmentsRoot(toolBar);
        if (attachmentsRoot) {
          injectQuoteButton(attachmentsRoot);
        } else {
          injectAiButton(toolBar);
        }
      }

      const attachmentsRoots = node.matches('[data-testid="attachments"]')
        ? [node]
        : node.querySelectorAll('[data-testid="attachments"]');
      for (const attachmentsRoot of attachmentsRoots) {
        if (isVisible(attachmentsRoot)) injectQuoteButton(attachmentsRoot);
      }
    }
  }
});

toolBarObserver.observe(document.body, { childList: true, subtree: true });

for (const toolBar of document.querySelectorAll('[data-testid="toolBar"]')) {
  if (!isVisible(toolBar)) continue;

  const attachmentsRoot = getQuoteAttachmentsRoot(toolBar);
  if (attachmentsRoot) {
    injectQuoteButton(attachmentsRoot);
  } else {
    injectAiButton(toolBar);
  }
}

for (const attachmentsRoot of document.querySelectorAll('[data-testid="attachments"]')) {
  if (isVisible(attachmentsRoot)) injectQuoteButton(attachmentsRoot);
}
