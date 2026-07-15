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
  var currentMode = 'ai';
  var pollInterval = null;
  var shownMessageIds = {};
  var feedbackShown = false;
  var hasSentMessage = false;
  var pollFailCount = 0;
  var preChatDone = false;
  var contactInfo = {};
  var container, bubble, bubbleHint, panel, messagesEl, footerEl, inputEl, sendBtn, statusEl, endBtn;

  var DEPARTMENTS = ['Reps', 'Comps', 'LTP', 'Referees', 'Other'];

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '@keyframes cbba-pulse{0%,100%{box-shadow:0 4px 16px rgba(0,0,0,0.25),0 0 0 0 rgba(96,68,132,0.5);}50%{box-shadow:0 4px 16px rgba(0,0,0,0.25),0 0 0 10px rgba(96,68,132,0);}}',
      '#cbba-widget-bubble{position:fixed;bottom:24px;right:24px;width:68px;height:68px;border-radius:50%;background:' + COLOR + ';box-shadow:0 4px 16px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9999;border:none;transition:transform 0.15s,box-shadow 0.15s;animation:cbba-pulse 2.5s ease-in-out infinite;}',
      '#cbba-widget-bubble:hover{transform:scale(1.07);animation:none;box-shadow:0 6px 20px rgba(0,0,0,0.3);}',
      '#cbba-widget-bubble svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;}',
      '#cbba-widget-hint{position:fixed;bottom:104px;right:24px;background:#fff;color:#21222c;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;font-weight:500;padding:8px 14px;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:9998;white-space:nowrap;cursor:pointer;animation:cbba-hint-in 0.3s ease;}',
      '#cbba-widget-hint::after{content:"";position:absolute;bottom:-6px;right:20px;width:12px;height:12px;background:#fff;transform:rotate(45deg);border-radius:0 0 2px 0;}',
      '@keyframes cbba-hint-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}',
      '#cbba-widget-panel{position:fixed;bottom:92px;right:24px;width:360px;height:520px;background:#21222c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.45);display:flex;flex-direction:column;z-index:9998;overflow:hidden;transform:scale(0.92) translateY(16px);transform-origin:bottom right;opacity:0;pointer-events:none;transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),opacity 0.15s;}',
      '#cbba-widget-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
      '#cbba-widget-header{background:' + COLOR + ';padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
      '#cbba-widget-header h3{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;font-weight:600;color:#fff;}',
      '#cbba-widget-status{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px;}',
      '#cbba-widget-header-actions{display:flex;align-items:center;gap:6px;}',
      '#cbba-widget-end{background:rgba(255,255,255,0.15);border:none;cursor:pointer;padding:4px 8px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:11px;border-radius:6px;line-height:1;display:none;}',
      '#cbba-widget-end:hover{background:rgba(255,255,255,0.25);}',
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
      // Pre-chat form
      '#cbba-prechat{flex:1;display:flex;flex-direction:column;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-y:auto;}',
      '#cbba-prechat h4{color:#fff;font-size:14px;font-weight:600;margin:0 0 4px;}',
      '#cbba-prechat p{color:rgba(255,255,255,0.5);font-size:12px;margin:0 0 18px;}',
      '.cbba-field{margin-bottom:12px;}',
      '.cbba-field label{display:block;font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:5px;}',
      '.cbba-field input,.cbba-field select{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:9px 11px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;color:#fff;outline:none;box-sizing:border-box;}',
      '.cbba-field input:focus,.cbba-field select:focus{border-color:' + COLOR + ';}',
      '.cbba-field select option{background:#21222c;color:#fff;}',
      '#cbba-prechat-start{width:100%;background:' + COLOR + ';color:#fff;border:none;border-radius:8px;padding:11px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;font-weight:500;margin-top:4px;}',
      '#cbba-prechat-start:hover{opacity:0.9;}',
      '#cbba-prechat-error{color:#f87171;font-size:11px;margin-bottom:8px;}',
      // Feedback panel
      '#cbba-feedback{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '#cbba-feedback h4{color:#fff;font-size:15px;font-weight:600;margin-bottom:8px;}',
      '#cbba-feedback p{color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:20px;}',
      '.cbba-stars{display:flex;gap:6px;margin-bottom:20px;}',
      '.cbba-star{font-size:32px;cursor:pointer;color:rgba(255,255,255,0.2);transition:color 0.1s;background:none;border:none;padding:0;line-height:1;}',
      '.cbba-star.active{color:#FBB33F;}',
      '.cbba-star:hover{color:#FBB33F;}',
      '#cbba-feedback-comment{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;color:#fff;resize:none;outline:none;min-height:72px;margin-bottom:12px;}',
      '#cbba-feedback-comment::placeholder{color:rgba(255,255,255,0.3);}',
      '#cbba-feedback-comment:focus{border-color:' + COLOR + ';}',
      '#cbba-feedback-submit{background:' + COLOR + ';color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;width:100%;font-weight:500;}',
      '#cbba-feedback-submit:hover{opacity:0.9;}',
      '#cbba-feedback-submit:disabled{opacity:0.4;cursor:default;}',
      '#cbba-feedback-skip{background:none;border:none;color:rgba(255,255,255,0.35);font-size:11px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;margin-top:8px;padding:4px;}',
      '#cbba-feedback-skip:hover{color:rgba(255,255,255,0.6);}',
      // Markdown rendering in AI messages
      '.cbba-msg-ai p{margin:0 0 6px;}',
      '.cbba-msg-ai p:last-child{margin-bottom:0;}',
      '.cbba-msg-ai ul{margin:4px 0 6px;padding-left:16px;}',
      '.cbba-msg-ai ul:last-child{margin-bottom:0;}',
      '.cbba-msg-ai li{margin-bottom:3px;}',
      '.cbba-msg-ai li:last-child{margin-bottom:0;}',
      '.cbba-msg-ai a{color:#a78bfa;text-decoration:underline;word-break:break-all;}',
      '.cbba-msg-ai a:hover{color:#c4b5fd;}',
      '.cbba-msg-ai strong{font-weight:600;color:#fff;}',
    ].join('');
    document.head.appendChild(style);
  }

  function buildWidget() {
    container = document.createElement('div');
    container.id = 'cbba-widget-container';

    // "How can I help?" hint bubble
    bubbleHint = document.createElement('div');
    bubbleHint.id = 'cbba-widget-hint';
    bubbleHint.textContent = 'How can I help? 👋';
    bubbleHint.addEventListener('click', openPanel);
    document.body.appendChild(bubbleHint);
    // Hide hint after 8 seconds or on first open
    setTimeout(function () { if (bubbleHint) bubbleHint.style.display = 'none'; }, 8000);

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
    header.innerHTML = '<div><h3>' + escHtml(TITLE) + '</h3><div id="cbba-widget-status">Connecting...</div></div><div id="cbba-widget-header-actions"><button id="cbba-widget-end">End chat</button><button id="cbba-widget-close" aria-label="Close chat"><svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button></div>';

    messagesEl = document.createElement('div');
    messagesEl.id = 'cbba-widget-messages';

    footerEl = document.createElement('div');
    footerEl.id = 'cbba-widget-footer';
    footerEl.innerHTML = '<textarea id="cbba-widget-input" placeholder="Type a message..." rows="1"></textarea><button id="cbba-widget-send" disabled aria-label="Send"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>';

    // Pre-chat form (shown before first message)
    var preChatEl = document.createElement('div');
    preChatEl.id = 'cbba-prechat';
    var deptOptions = DEPARTMENTS.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
    preChatEl.innerHTML =
      '<h4>Before we start</h4>' +
      '<p>Please share a few details so we can assist you better.</p>' +
      '<div class="cbba-field"><label>Your name *</label><input id="cbba-pc-name" type="text" placeholder="Jane Smith" autocomplete="name"/></div>' +
      '<div class="cbba-field"><label>Email address</label><input id="cbba-pc-email" type="email" placeholder="jane@example.com" autocomplete="email"/></div>' +
      '<div class="cbba-field"><label>Department</label><select id="cbba-pc-dept"><option value="">Select department...</option>' + deptOptions + '</select></div>' +
      '<div id="cbba-prechat-error" style="display:none"></div>' +
      '<button id="cbba-prechat-start">Start chat</button>';

    panel.appendChild(header);
    panel.appendChild(preChatEl);
    panel.appendChild(messagesEl);
    panel.appendChild(footerEl);

    // Initially hide chat view, show pre-chat
    messagesEl.style.display = 'none';
    footerEl.style.display = 'none';

    container.appendChild(bubble);
    container.appendChild(panel);
    document.body.appendChild(container);

    statusEl = document.getElementById('cbba-widget-status');
    inputEl = document.getElementById('cbba-widget-input');
    sendBtn = document.getElementById('cbba-widget-send');
    endBtn = document.getElementById('cbba-widget-end');

    bubble.addEventListener('click', togglePanel);
    document.getElementById('cbba-widget-close').addEventListener('click', closePanel);
    endBtn.addEventListener('click', handleEndChat);

    document.getElementById('cbba-prechat-start').addEventListener('click', handlePreChatSubmit);
    document.getElementById('cbba-pc-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handlePreChatSubmit();
    });

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
  }

  function handlePreChatSubmit() {
    var nameEl = document.getElementById('cbba-pc-name');
    var emailEl = document.getElementById('cbba-pc-email');
    var deptEl = document.getElementById('cbba-pc-dept');
    var errEl = document.getElementById('cbba-prechat-error');

    var name = nameEl ? nameEl.value.trim() : '';
    var email = emailEl ? emailEl.value.trim() : '';
    var dept = deptEl ? deptEl.value : '';

    if (!name) {
      errEl.textContent = 'Please enter your name to continue.';
      errEl.style.display = 'block';
      if (nameEl) nameEl.focus();
      return;
    }
    errEl.style.display = 'none';

    contactInfo = { name: name, email: email || null, department: dept || null };
    preChatDone = true;

    // Hide pre-chat, show chat
    var preChatEl = document.getElementById('cbba-prechat');
    if (preChatEl) preChatEl.style.display = 'none';
    messagesEl.style.display = 'flex';
    footerEl.style.display = 'flex';

    setStatus('ai');
    appendMessage('system', 'Hi ' + name + '! How can we help you today?');
    inputEl.disabled = false;
    sendBtn.disabled = true;
    setTimeout(function () { inputEl && inputEl.focus(); }, 50);
  }

  function setStatus(mode) {
    currentMode = mode;
    if (!statusEl) return;
    statusEl.textContent = mode === 'live' ? 'Live support' : 'AI assistant';
    if (mode === 'live') startPolling();
  }

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(function () {
      fetch(BASE_URL + '/api/chat/poll?session_id=' + encodeURIComponent(sessionId))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (pollFailCount >= 5 && preChatDone) {
            appendMessage('system', 'Reconnected.');
          }
          pollFailCount = 0;
          if (data.messages && data.messages.length) {
            data.messages.forEach(function (msg) {
              if (!shownMessageIds[msg.id]) {
                shownMessageIds[msg.id] = true;
                appendMessage('ai', msg.content);
              }
            });
          }
          // Staff closed the conversation
          if (data.closed && data.feedbackToken && !feedbackShown) {
            stopPolling();
            appendMessage('system', 'This conversation has been closed by our team.');
            setTimeout(function () { showFeedbackForm(data.feedbackToken); }, 800);
          }
        })
        .catch(function () {
          pollFailCount++;
          if (pollFailCount === 5 && preChatDone) {
            appendMessage('system', 'Connection lost. Retrying...');
          }
        });
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function resumeSession(data) {
    var preChatEl = document.getElementById('cbba-prechat');
    if (preChatEl) preChatEl.style.display = 'none';
    messagesEl.style.display = 'flex';
    footerEl.style.display = 'flex';
    preChatDone = true;
    hasSentMessage = true;
    if (data.contactName) contactInfo = { name: data.contactName };
    (data.messages || []).forEach(function (msg) {
      if (msg.role !== 'user' && msg.id) shownMessageIds[msg.id] = true;
      appendMessage(msg.role, msg.content);
    });
    if (data.closed) {
      disableInput();
      if (data.feedbackToken && !feedbackShown) {
        setTimeout(function () { showFeedbackForm(data.feedbackToken); }, 300);
      }
    } else {
      setStatus(data.mode);
      inputEl.disabled = false;
      sendBtn.disabled = true;
      if (endBtn) endBtn.style.display = 'block';
      startPolling();
    }
  }

  function handleEndChat() {
    if (!hasSentMessage) {
      closePanel();
      return;
    }
    // Customer-initiated close
    fetch(BASE_URL + '/api/chat/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        stopPolling();
        disableInput();
        appendMessage('system', 'Chat ended. Thank you for contacting us!');
        if (data.feedbackToken) {
          setTimeout(function () { showFeedbackForm(data.feedbackToken); }, 600);
        }
      })
      .catch(function () {
        closePanel();
      });
  }

  function showFeedbackForm(token) {
    if (feedbackShown) return;
    feedbackShown = true;

    // Remove footer
    var footer = document.getElementById('cbba-widget-footer');
    if (footer) footer.style.display = 'none';

    // Replace messages with feedback panel
    messagesEl.style.display = 'none';

    var fb = document.createElement('div');
    fb.id = 'cbba-feedback';

    var selectedRating = 0;

    fb.innerHTML = '<h4>How did we do?</h4><p>Rate your experience with us today.</p>' +
      '<div class="cbba-stars">' +
      '<button class="cbba-star" data-r="1">&#9733;</button>' +
      '<button class="cbba-star" data-r="2">&#9733;</button>' +
      '<button class="cbba-star" data-r="3">&#9733;</button>' +
      '<button class="cbba-star" data-r="4">&#9733;</button>' +
      '<button class="cbba-star" data-r="5">&#9733;</button>' +
      '</div>' +
      '<textarea id="cbba-feedback-comment" placeholder="Any additional comments? (optional)"></textarea>' +
      '<button id="cbba-feedback-submit" disabled>Submit feedback</button>' +
      '<button id="cbba-feedback-skip">Skip</button>';

    panel.insertBefore(fb, messagesEl.nextSibling || null);
    panel.appendChild(fb);

    var stars = fb.querySelectorAll('.cbba-star');
    var commentEl = document.getElementById('cbba-feedback-comment');
    var submitBtn = document.getElementById('cbba-feedback-submit');
    var skipBtn = document.getElementById('cbba-feedback-skip');

    stars.forEach(function (star) {
      star.addEventListener('mouseenter', function () {
        var r = parseInt(this.getAttribute('data-r'));
        stars.forEach(function (s, i) {
          s.style.color = i < r ? '#FBB33F' : 'rgba(255,255,255,0.2)';
        });
      });
      star.addEventListener('mouseleave', function () {
        stars.forEach(function (s, i) {
          s.style.color = i < selectedRating ? '#FBB33F' : 'rgba(255,255,255,0.2)';
        });
      });
      star.addEventListener('click', function () {
        selectedRating = parseInt(this.getAttribute('data-r'));
        stars.forEach(function (s, i) {
          s.style.color = i < selectedRating ? '#FBB33F' : 'rgba(255,255,255,0.2)';
          if (i < selectedRating) s.classList.add('active'); else s.classList.remove('active');
        });
        submitBtn.disabled = false;
      });
    });

    submitBtn.addEventListener('click', function () {
      if (!selectedRating) return;
      submitBtn.disabled = true;
      var comment = commentEl ? commentEl.value.trim() : '';
      fetch(BASE_URL + '/api/feedback/' + encodeURIComponent(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selectedRating, comment: comment }),
      })
        .then(function () { showThankYou(); })
        .catch(function () { showThankYou(); });
    });

    skipBtn.addEventListener('click', function () {
      showThankYou();
    });
  }

  function showThankYou() {
    var fb = document.getElementById('cbba-feedback');
    if (fb) {
      fb.innerHTML = '<h4>Thank you!</h4><p>We appreciate your feedback. It helps us improve our service.</p>';
    }
  }

  function disableInput() {
    if (inputEl) { inputEl.disabled = true; inputEl.placeholder = 'Chat ended'; }
    if (sendBtn) sendBtn.disabled = true;
    if (endBtn) endBtn.style.display = 'none';
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>';
    bubble.style.animation = 'none';
    if (bubbleHint) bubbleHint.style.display = 'none';
    if (preChatDone && !pollInterval) startPolling();
    setTimeout(function () {
      if (preChatDone) {
        inputEl && !inputEl.disabled && inputEl.focus();
      } else {
        var nameEl = document.getElementById('cbba-pc-name');
        if (nameEl) nameEl.focus();
      }
    }, 200);
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
    hasSentMessage = true;

    // Show End chat button once a message is sent
    if (endBtn) endBtn.style.display = 'block';

    appendMessage('user', text);
    var typing = appendTyping();
    inputEl.disabled = true;

    fetch(BASE_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId, contact_info: contactInfo }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        removeEl(typing);
        inputEl.disabled = false;
        inputEl.focus();
        if (data.mode) setStatus(data.mode);
        // Always poll after first message so staff replies are visible in any mode
        startPolling();
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

  function renderMarkdown(text) {
    function applyBold(s) {
      return s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    }
    function inline(s) {
      var result = '';
      var urlRegex = /(https?:\/\/[^\s<>"',)]+)/g;
      var lastIndex = 0;
      var match;
      while ((match = urlRegex.exec(s)) !== null) {
        result += applyBold(escHtml(s.slice(lastIndex, match.index)));
        var url = escHtml(match[1]);
        result += '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
        lastIndex = match.index + match[0].length;
      }
      result += applyBold(escHtml(s.slice(lastIndex)));
      return result;
    }
    var lines = text.split('\n');
    var html = '';
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^[-*]\s/.test(line)) {
        var items = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i])) {
          items.push('<li>' + inline(lines[i].replace(/^[-*]\s+/, '')) + '</li>');
          i++;
        }
        html += '<ul>' + items.join('') + '</ul>';
        continue;
      }
      if (line.trim() === '') { i++; continue; }
      html += '<p>' + inline(line) + '</p>';
      i++;
    }
    return html;
  }

  function appendMessage(type, text) {
    var el = document.createElement('div');
    el.className = 'cbba-msg cbba-msg-' + type;
    if (type === 'ai') {
      el.innerHTML = renderMarkdown(text);
    } else {
      el.textContent = text;
    }
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

  function initWidget() {
    injectStyles();
    buildWidget();
    if (sessionStorage.getItem(SESSION_KEY)) {
      fetch(BASE_URL + '/api/chat/session?session_id=' + encodeURIComponent(sessionId))
        .then(function (res) { return res.json(); })
        .then(function (data) { if (data.exists) resumeSession(data); })
        .catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
