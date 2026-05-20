(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var BASE_URL = script.getAttribute('data-url') || '';
  var TITLE = script.getAttribute('data-title') || 'CBBA Support';
  var COLOR = script.getAttribute('data-color') || '#604484';
  var SESSION_KEY = 'cbba_chat_session';

  function getSessionId() {
    var id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  var sessionId = getSessionId();
  var isOpen = false;
  var container, bubble, panel, messagesEl, inputEl, sendBtn, statusEl;
  var pollInterval = null;
  var lastPollTime = null;
  var currentMode = 'ai';

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#cbba-widget-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:' + COLOR + ';box-shadow:0 4px 16px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9999;border:none;transition:transform 0.15s,box-shadow 0.15s;}',
      '#cbba-widget-bubble:hover{transform:scale(1.07);box-shadow:0 6px 20px rgba(0,0,0,0.3);}',
      '#cbba-widget-bubble svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;}',
      '#cbba-widget-panel{position:fixed;bottom:92px;right:24px;width:360px;height:520px;background:#21222c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.45);display:flex;flex-direction:column;z-index:9998;overflow:hidden;transform:scale(0.92) translateY(16px);transform-origin:bottom right;opacity:0;pointer-events:none;transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),opacity 0.15s;}',
      '#cbba-widget-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
      '#cbba-widget-header{background:' + COLOR + ';padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
      '#cbba-widget-header h3{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;font-weight:600;color:#fff;}',
      '#cbba-widget-status{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px;}',
      '#cbba-widget-close{background:none;border:none;cursor:pointer;padding:4px;color:rgba(255,255,255,0.8);line-height:0;}',
      '#cbba-widget-close svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;}',
      '#cbba-widget-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;}',
      '#cbba-widget-messages::-webkit-scrollbar{width:4px;}',
      '#cbba-widget-messages::-webkit-scrollbar-track{background:transparent;}',
      '#cbba-widget-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}',
      '.cbba-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.45;word-break:break-word;}',
      '.cbba-msg-user{align-self:flex-end;background:' + COLOR + ';color:#fff;border-bottom-right-radius:3px;}',
      '.cbba-msg-ai{align-self:flex-start;background:rgba(255,255,255,0.07);color:#e5e5e5;border-bottom-left-radius:3px;}',
      '.cbba-msg-system{align-self:center;font-size:11px;color:rgba(255,255,255,0.35);font-style:italic;max-width:100%;text-align:center;padding:4px 0;}',
      '.cbba-typing{align-self:flex-start;display:flex;gap:4px;padding:10px 14px;background:rgba(255,255,255,0.07);border-radius:12px;border-bottom-left-radius:3px;}',
      '.cbba-typing span{width:6px;height:6px;background:rgba(255,255,255,0.4);border-radius:50%;animation:cbba-bounce 1.2s ease-in-out infinite;}',
      '.cbba-typing span:nth-child(2){animation-delay:0.2s;}',
      '.cbba-typing span:nth-child(3){animation-delay:0.4s;}',
      '@keyframes cbba-bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-5px);}}',
      '#cbba-widget-footer{padding:10px 12px;border-top:1px solid rgba(255,255,255,0.07);display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}',
      '#cbba-widget-input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;color:#fff;resize:none;outline:none;max-height:100px;min-height:38px;line-height:1.4;}',
      '#cbba-widget-input::placeholder{color:rgba(255,255,255,0.3);}',
      '#cbba-widget-input:focus{border-color:' + COLOR + ';}',
      '#cbba-widget-send{background:' + COLOR + ';border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s;}',
      '#cbba-widget-send:disabled{opacity:0.4;cursor:default;}',
      '#cbba-widget-send svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2;}',
    ].join('');
    document.head.appendChild(style);
  }

  function buildWidget() {
    container = document.createElement('div');
    container.id = 'cbba-widget-container';

    bubble = document.createElement('button');
    bubble.id = 'cbba-widget-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>';

    panel = document.createElement('div');
    panel.id = 'cbba-widget-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', TITLE);

    var header = document.createElement('div');
    header.id = 'cbba-widget-header';
    header.innerHTML = '<div><h3>' + escHtml(TITLE) + '</h3><div id="cbba-widget-status">Connecting...</div></div><button id="cbba-widget-close" aria-label="Close chat"><svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button>';

    messagesEl = document.createElement('div');
    messagesEl.id = 'cbba-widget-messages';

    var footer = document.createElement('div');
    footer.id = 'cbba-widget-footer';
    footer.innerHTML = '<textarea id="cbba-widget-input" placeholder="Type a message..." rows="1"></textarea><button id="cbba-widget-send" disabled aria-label="Send"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>';

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(footer);

    container.appendChild(bubble);
    container.appendChild(panel);
    document.body.appendChild(container);

    statusEl = document.getElementById('cbba-widget-status');
    inputEl = document.getElementById('cbba-widget-input');
    sendBtn = document.getElementById('cbba-widget-send');

    bubble.addEventListener('click', togglePanel);
    document.getElementById('cbba-widget-close').addEventListener('click', closePanel);

    inputEl.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      sendBtn.disabled = !this.value.trim();
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    setStatus('ai');
    appendMessage('system', 'Hi! How can we help you today?');
    inputEl.disabled = false;
    sendBtn.disabled = !inputEl.value.trim();
  }

  function setStatus(mode) {
    currentMode = mode;
    if (!statusEl) return;
    statusEl.textContent = mode === 'live' ? 'Live support' : 'AI assistant';
    if (mode === 'live') startPolling();
  }

  function startPolling() {
    if (pollInterval) return;
    lastPollTime = new Date().toISOString();
    pollInterval = setInterval(function () {
      fetch(BASE_URL + '/api/chat/poll?session_id=' + encodeURIComponent(sessionId) + '&since=' + encodeURIComponent(lastPollTime))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.messages || !data.messages.length) return;
          data.messages.forEach(function (msg) {
            appendMessage('ai', msg.content);
          });
          lastPollTime = data.messages[data.messages.length - 1].created_at;
        })
        .catch(function () {});
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>';
    if (currentMode === 'live' && !pollInterval) startPolling();
    setTimeout(function () { inputEl && inputEl.focus(); }, 200);
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>';
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', text);
    var typing = appendTyping();
    inputEl.disabled = true;

    fetch(BASE_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        removeEl(typing);
        inputEl.disabled = false;
        inputEl.focus();
        if (data.mode) setStatus(data.mode);
        if (data.reply) {
          appendMessage('ai', data.reply);
        } else if (data.error) {
          appendMessage('system', 'Error: ' + data.error);
        }
      })
      .catch(function () {
        removeEl(typing);
        inputEl.disabled = false;
        appendMessage('system', 'Failed to send message. Please try again.');
      });
  }

  function appendMessage(type, text) {
    var el = document.createElement('div');
    el.className = 'cbba-msg cbba-msg-' + type;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function appendTyping() {
    var el = document.createElement('div');
    el.className = 'cbba-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function removeEl(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      buildWidget();
    });
  } else {
    injectStyles();
    buildWidget();
  }
})();
