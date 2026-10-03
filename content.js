// content.js - работает в контексте страницы, связывает inject.js с расширением

console.log("🎮 Game Bot Content Script loaded");

// ===== INJECT PAGE SCRIPTS =====
// async = false сохраняет порядок выполнения для динамически добавленных скриптов
(function() {
  ['inject.js', 'overrides.js'].forEach(file => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(file);
    script.async = false;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  });
})();

// ===== ПЕРЕХВАТ ДИАЛОГОВ (БЕЗ СДАЧИ) =====
// Широкие селекторы ('.modal', '.popup', '[class*="dialog"]') попадали в обычную
// разметку игры и приводили к авто-кликам по интерфейсу во время загрузки.
const DIALOG_SELECTOR = '.dialog, .confirm, [role="dialog"], [role="alertdialog"]';
const DIALOG_SCAN_INTERVAL_MS = 500;
let dialogActionCooldownUntil = 0;

// Пауза после собственного клика: иначе клик -> мутация -> клик зацикливается
function markDialogAction() {
  dialogActionCooldownUntil = Date.now() + 600;
}

// Обрабатывает один видимый диалог, возвращает true если был клик
function handleDialog(el) {
  // Ищем кнопку OK, Да, Подтвердить (НЕ СДАЧА)
  const okButtons = el.querySelectorAll('.button.green, .button.yes, .btn-success, .ok, .confirm, .btn-primary');
  for (const btn of okButtons) {
    const text = (btn.textContent || "").toLowerCase();
    // Пропускаем кнопку "Сдаться"
    if (text.includes("сдаться")) continue;
    if (text.includes("ok") || text.includes("да") || text.includes("подтвердить") || text.includes("yes")) {
      console.log("✅ AUTO-CLICK OK:", btn.textContent);
      btn.click();
      markDialogAction();
      return true;
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
      markDialogAction();
      return true;
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
      markDialogAction();
      return true;
    }
  }

  return false;
}

// Функция для автоматического закрытия диалогов (кроме сдачи)
function autoCloseDialogs() {
  if (Date.now() < dialogActionCooldownUntil) return;

  for (const el of document.querySelectorAll(DIALOG_SELECTOR)) {
    if (el.offsetParent === null) continue; // Только видимые
    if (handleDialog(el)) return;
  }
}

// ===== ЭМУЛЯЦИЯ НАЖАТИЯ ENTER (БЕЗ СДАЧИ) =====
function autoPressEnter() {
  if (Date.now() < dialogActionCooldownUntil) return;

  for (const dialog of document.querySelectorAll(DIALOG_SELECTOR)) {
    if (dialog.offsetParent === null) continue;

    // Проверяем, не диалог ли это сдачи
    const hasSurrenderBtn = dialog.querySelector('.button.red.withtext');
    if (hasSurrenderBtn && hasSurrenderBtn.textContent === "Сдаться") {
      console.log("⏭️ Пропускаем диалог сдачи");
      continue;
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
    markDialogAction();
    console.log("⌨️ AUTO-ENTER на диалоге");
    return;
  }
}

// ===== MUTATION OBSERVER (с троттлингом) =====
let dialogScanScheduled = false;
let lastDialogScanAt = 0;

function runDialogAutomation() {
  dialogScanScheduled = false;
  if (document.hidden) return;
  lastDialogScanAt = Date.now();
  autoCloseDialogs();
  autoPressEnter();
}

// Без троттлинга наблюдатель запускал полный обход DOM на каждой мутации
function scheduleDialogScan() {
  if (dialogScanScheduled) return;
  dialogScanScheduled = true;
  setTimeout(runDialogAutomation, Math.max(0, DIALOG_SCAN_INTERVAL_MS - (Date.now() - lastDialogScanAt)));
}

const observer = new MutationObserver(scheduleDialogScan);

function startDialogAutomation() {
  if (startDialogAutomation.started || !document.body) return;
  startDialogAutomation.started = true;

  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(scheduleDialogScan, 1000);
}

// Стартуем только после полной загрузки: на document_start обработка тысяч
// мутаций инициализации страницы вешала вкладку и сайт не прогружался
if (document.readyState === 'complete') {
  startDialogAutomation();
} else {
  window.addEventListener('load', startDialogAutomation, { once: true });
}

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
    if (typeof action === 'string' && action.endsWith('_response') && resolveBridgeRequest(requestId, data || { success: true })) {
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
  if (request.action === 'resetStats' || request.action === 'resetAllStats') {
    const requestId = nextBridgeRequestId++;
    bridgePendingRequests.set(requestId, sendResponse);
    window.postMessage({ type: 'TO_GAME_BOT', action: request.action, requestId }, '*');
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