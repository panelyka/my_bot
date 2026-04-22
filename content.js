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

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style', 'class', 'display']
});

// Запускаем авто-закрытие каждые 200мс
setInterval(autoCloseDialogs, 200);
setInterval(autoPressEnter, 300);

// ===== ПЕРЕХВАТ ОРИГИНАЛЬНЫХ ФУНКЦИЙ (БЕЗ СДАЧИ) =====
const overrideScript = document.createElement('script');
overrideScript.textContent = `
  (function() {
    // Переопределяем confirm (никогда не подтверждаем сдачу)
    const originalConfirm = window.confirm;
    window.confirm = function(message) {
      // Если сообщение о сдаче - возвращаем false (отмена)
      if (message && message.toLowerCase().includes("сдаться")) {
        console.log("🚫 AUTO-CANCEL surrender confirm");
        return false;
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
    
    console.log("🔧 Page functions overridden (surrender disabled)");
  })();
`;
(document.head || document.documentElement).appendChild(overrideScript);
overrideScript.onload = () => overrideScript.remove();

// ===== MESSAGE BRIDGE =====
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'FROM_GAME_BOT') {
    const { action, data } = event.data;
    chrome.runtime.sendMessage({ action, data }, (response) => {
      window.postMessage({
        type: 'TO_GAME_BOT',
        action: action + '_response',
        data: response
      }, '*');
    });
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

console.log("✅ GameBot Content Script ready - Surrender disabled");