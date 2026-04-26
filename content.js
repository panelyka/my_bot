// content.js - работает в контексте страницы, связывает inject.js с расширением

console.log("🎮 Game Bot Content Script loaded");

// ===== INJECT MAIN SCRIPT =====
(function() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
})();

// ===== ПЕРЕХВАТ ДИАЛОГОВ (БЕЗ СДАЧИ) =====
// Функция для автоматического закрытия диалогов (кроме сдачи)
function autoCloseDialogs() {
  // Ищем диалоги подтверждения
  const dialogSelectors = [
    '.dialog', '.confirm', '.modal', '.popup', 
    '[class*="confirm"]', '[class*="dialog"]', '[class*="modal"]',
    '[role="dialog"]', '[role="alertdialog"]'
  ];
  
  dialogSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (el.offsetParent !== null) { // Видимый элемент
        console.log("🔍 Найден диалог:", selector);
        
        // Ищем кнопку OK, Да, Подтвердить (НЕ СДАЧА)
        const okButtons = el.querySelectorAll('.button.green, .button.yes, .btn-success, .ok, .confirm, .btn-primary');
        for (const btn of okButtons) {
          const text = (btn.textContent || "").toLowerCase();
          // Пропускаем кнопку "Сдаться"
          if (text.includes("сдаться")) continue;
          if (text.includes("ok") || text.includes("да") || text.includes("подтвердить") || text.includes("yes")) {
            console.log("✅ AUTO-CLICK OK:", btn.textContent);
            btn.click();
            return;
          }
        }
        
        // Ищем любую кнопку с текстом OK/Да (НЕ СДАЧА)
        const allButtons = el.querySelectorAll('button, .button, .btn');
        for (const btn of allButtons) {
          const text = (btn.textContent || "").toLowerCase();
          if (text.includes("сдаться")) continue;
          if (text === "ok" || text === "да" || text === "yes" || text === "подтвердить") {
            console.log("✅ AUTO-CLICK BUTTON:", btn.textContent);
            btn.click();
            return;
          }
        }
        
        // Ищем кнопку "Закрыть"
        const closeButtons = el.querySelectorAll('.close, .cancel, .button.red, .btn-danger');
        for (const btn of closeButtons) {
          const text = (btn.textContent || "").toLowerCase();
          if (text.includes("сдаться")) continue;
          if (text.includes("закрыть") || text.includes("cancel") || text.includes("отмена")) {
            console.log("❌ AUTO-CLOSE:", btn.textContent);
            btn.click();
            return;
          }
        }
      }
    });
  });
}

// ===== ЭМУЛЯЦИЯ НАЖАТИЯ ENTER (БЕЗ СДАЧИ) =====
function autoPressEnter() {
  const dialogs = document.querySelectorAll('.dialog, .confirm, .modal, [class*="confirm"], [class*="dialog"]');
  dialogs.forEach(dialog => {
    if (dialog.offsetParent !== null) {
      // Проверяем, не диалог ли это сдачи
      const hasSurrenderBtn = dialog.querySelector('.button.red.withtext');
      if (hasSurrenderBtn && hasSurrenderBtn.textContent === "Сдаться") {
        console.log("⏭️ Пропускаем диалог сдачи");
        return;
      }
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      dialog.dispatchEvent(enterEvent);
      document.dispatchEvent(enterEvent);
      console.log("⌨️ AUTO-ENTER на диалоге");
    }
  });
}

// ===== MUTATION OBSERVER =====
const observer = new MutationObserver(() => {
  autoCloseDialogs();
  autoPressEnter();
});

function startDialogAutomation() {
  if (startDialogAutomation.started || !document.body) return;
  startDialogAutomation.started = true;

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'display']
  });
}

startDialogAutomation();
if (!startDialogAutomation.started) {
  document.addEventListener('DOMContentLoaded', startDialogAutomation, { once: true });
}

// Запускаем авто-закрытие каждые 200мс
setInterval(autoCloseDialogs, 200);
setInterval(autoPressEnter, 300);

// ===== ПЕРЕХВАТ ОРИГИНАЛЬНЫХ ФУНКЦИЙ (БЕЗ СДАЧИ) =====
const overrideScript = document.createElement('script');
overrideScript.textContent = `
  (function() {
    window.__gameBotAllowSurrenderConfirmUntil = 0;
    window.__gameBotDebugSurrenderConfirm = false;
    window.__gameBotDebugSurrenderClick = false;
    window.__gameBotLastSurrenderClickAt = 0;

    const CLICK_TRACE_WINDOW_MS = 1500;
    const wrappedClickListeners = new WeakMap();

    function getSurrenderElement(node) {
      if (!(node instanceof Element)) return null;
      return node.closest('button, .button, .btn, a, [role="button"], input[type="button"], input[type="submit"]');
    }

    function getElementLabel(element) {
      if (!element) return '';
      return (element.textContent || element.value || element.getAttribute('aria-label') || '').trim().toLowerCase();
    }

    function isSurrenderElement(element) {
      return getElementLabel(element).includes('сдаться');
    }

    function logSurrenderTrace(title, payload) {
      console.group(title);
      Object.entries(payload).forEach(([key, value]) => console.log(key + ':', value));
      console.groupEnd();
    }

    document.addEventListener('click', function(event) {
      if (!window.__gameBotDebugSurrenderClick) return;

      const element = getSurrenderElement(event.target);
      if (!isSurrenderElement(element)) return;

      window.__gameBotLastSurrenderClickAt = Date.now();
      logSurrenderTrace('🔎 GAMEBOT SURRENDER CLICK TRACE', {
        element,
        html: element?.outerHTML,
        stack: new Error('GameBot surrender click trace').stack
      });
      debugger;
    }, true);

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type !== 'click' || !listener || wrappedClickListeners.has(listener)) {
        return originalAddEventListener.call(this, type, listener, options);
      }

      const registrationStack = new Error('GameBot click listener registration').stack;
      const wrappedListener = function(event) {
        const recentSurrenderClick = Number(window.__gameBotLastSurrenderClickAt || 0) + CLICK_TRACE_WINDOW_MS > Date.now();
        const surrenderTarget = getSurrenderElement(event?.target);
        if (window.__gameBotDebugSurrenderClick && (recentSurrenderClick || isSurrenderElement(surrenderTarget))) {
          logSurrenderTrace('🧭 GAMEBOT CLICK LISTENER TRACE', {
            currentTarget: this,
            target: event?.target,
            surrenderTarget,
            listener,
            listenerSource: typeof listener === 'function' ? String(listener).slice(0, 1200) : listener,
            registrationStack,
            invocationStack: new Error('GameBot click listener invocation').stack
          });
          debugger;
        }

        if (typeof listener === 'function') {
          return listener.call(this, event);
        }

        return listener.handleEvent.call(listener, event);
      };

      wrappedClickListeners.set(listener, wrappedListener);
      return originalAddEventListener.call(this, type, wrappedListener, options);
    };

    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const wrappedListener = wrappedClickListeners.get(listener);
      return originalRemoveEventListener.call(this, type, wrappedListener || listener, options);
    };

    // Переопределяем confirm (ручную сдачу не блокируем)
    const originalConfirm = window.confirm;
    window.confirm = function(message) {
      const isSurrenderConfirm = typeof message === 'string' && message.toLowerCase().includes("сдаться");
      if (isSurrenderConfirm) {
        if (window.__gameBotDebugSurrenderConfirm) {
          const stack = new Error("GameBot surrender confirm trace").stack;
          console.group("🔎 GAMEBOT SURRENDER CONFIRM TRACE");
          console.log("message:", message);
          console.log("allowUntil:", window.__gameBotAllowSurrenderConfirmUntil || 0);
          console.log("stack:", stack);
          console.groupEnd();
          debugger;
        }

        const allowSurrender = Number(window.__gameBotAllowSurrenderConfirmUntil || 0) > Date.now();
        if (allowSurrender) {
          window.__gameBotAllowSurrenderConfirmUntil = 0;
          console.log("✅ AUTO-ALLOW surrender confirm");
          return true;
        }

        return originalConfirm.apply(this, arguments);
      }

      console.log("✅ AUTO-CONFIRM:", message);
      return true;
    };
    
    // Переопределяем alert
    const originalAlert = window.alert;
    window.alert = function(message) {
      console.log("📢 AUTO-ALERT:", message);
      return true;
    };
    
    // Переопределяем prompt
    const originalPrompt = window.prompt;
    window.prompt = function(message, defaultValue) {
      console.log("💬 AUTO-PROMPT:", message);
      return defaultValue || "";
    };
    
    // Отключаем onbeforeunload
    window.onbeforeunload = null;
    
    console.log("🔧 Page functions overridden (manual surrender preserved)");
  })();
`;
(document.head || document.documentElement).appendChild(overrideScript);
overrideScript.onload = () => overrideScript.remove();

// ===== MESSAGE BRIDGE =====
const bridgePendingRequests = new Map();
let nextBridgeRequestId = 1;

function resolveBridgeRequest(requestId, payload) {
  if (!bridgePendingRequests.has(requestId)) return false;
  const respond = bridgePendingRequests.get(requestId);
  bridgePendingRequests.delete(requestId);
  respond(payload);
  return true;
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'FROM_GAME_BOT') {
    const { action, data, requestId } = event.data;
    if (action === 'resetStats_response' && resolveBridgeRequest(requestId, data || { success: true })) {
      return;
    }

    chrome.runtime.sendMessage({ action, data }, (response) => {
      window.postMessage({
        type: 'TO_GAME_BOT',
        action: action + '_response',
        requestId,
        data: response
      }, '*');
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'resetStats') {
    const requestId = nextBridgeRequestId++;
    bridgePendingRequests.set(requestId, sendResponse);
    window.postMessage({ type: 'TO_GAME_BOT', action: 'resetStats', requestId }, '*');
    window.setTimeout(() => {
      resolveBridgeRequest(requestId, { success: false, error: 'reset-timeout' });
    }, 5000);
    return true;
  }
});

// ===== SOUND NOTIFICATION =====
let healPopupActive = false;

function playHealSound() {
  try {
    const audio = new Audio(chrome.runtime.getURL("sounds/heal.mp3"));
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio error:", e));
  } catch(e) {
    console.log("Audio error:", e);
  }
}

setInterval(() => {
  const el = document.querySelector(".divContent");
  if (!el) {
    healPopupActive = false;
    return;
  }
  
  const text = el.textContent.trim();
  if (text === "Монстры успешно вылечены." || text === "Лечение не требуется.") {
    if (!healPopupActive) {
      healPopupActive = true;
      playHealSound();
      setTimeout(() => { healPopupActive = false; }, 3000);
    }
  }
}, 500);

// ===== ЗАКРЫТИЕ ДИАЛОГОВ ПО ESC =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const dialogs = document.querySelectorAll('.dialog, .confirm, .modal, [class*="confirm"]');
    dialogs.forEach(dialog => {
      if (dialog.offsetParent !== null) {
        const closeBtn = dialog.querySelector('.close, .cancel, .button.red');
        if (closeBtn) closeBtn.click();
      }
    });
  }
});

console.log("✅ GameBot Content Script ready - Manual surrender preserved");