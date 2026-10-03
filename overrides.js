// overrides.js - выполняется в контексте страницы (отдельный файл из-за CSP)

(function() {
  window.__gameBotAllowSurrenderConfirmUntil = window.__gameBotAllowSurrenderConfirmUntil || 0;
  window.__gameBotDebugSurrenderConfirm = Boolean(window.__gameBotDebugSurrenderConfirm);
  window.__gameBotDebugSurrenderClick = Boolean(window.__gameBotDebugSurrenderClick);

  // Переопределяем confirm (ручную сдачу не блокируем)
  const originalConfirm = window.confirm;
  window.confirm = function(message) {
    const isSurrenderConfirm = typeof message === 'string' && message.toLowerCase().includes("сдаться");
    if (isSurrenderConfirm) {
      if (window.__gameBotDebugSurrenderConfirm) {
        console.group("🔎 GAMEBOT SURRENDER CONFIRM TRACE");
        console.log("message:", message);
        console.log("allowUntil:", window.__gameBotAllowSurrenderConfirmUntil || 0);
        console.log("stack:", new Error("GameBot surrender confirm trace").stack);
        console.groupEnd();
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
  window.alert = function(message) {
    console.log("📢 AUTO-ALERT:", message);
    return true;
  };

  // Переопределяем prompt
  window.prompt = function(message, defaultValue) {
    console.log("💬 AUTO-PROMPT:", message);
    return defaultValue || "";
  };

  // Отключаем onbeforeunload
  window.onbeforeunload = null;

  console.log("🔧 Page functions overridden (manual surrender preserved)");
})();
