chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_REPLY') {
    callGemini(message.apiKey, message.prompt)
      .then(reply => sendResponse({ success: true, reply }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const reply = data.candidates[0].content.parts.map(part => part.text || '').join('');
  return cleanGeneratedReply(reply);
}

function cleanGeneratedReply(reply) {
  const text = reply.trim().replace(/\n[ \t]+/g, '\n');

  return cleanupReplyText(
    text
      .split('\n')
      .filter(line => !isMetaLine(line))
      .join('\n')
  );
}

function cleanupReplyText(text) {
  return text
    .trim()
    .replace(/\s*\(\s*\d+\s*(?:chars?|characters?|文字)\s*\)\s*$/i, '')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function isMetaLine(line) {
  return /\b(?:let'?s|wait|check|go with|chars?|characters?|professional investor)\b/i.test(line) ||
    /\b(?:yes|no|ok|ng)\b/i.test(line);
}
