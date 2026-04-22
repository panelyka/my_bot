// Service Worker для расширения
chrome.runtime.onInstalled.addListener(() => {
  console.log("Game Bot Extension installed");
  
  chrome.storage.local.set({
    settings: {
      auto: true,
      healPath: "",
      healPathBack: "",
      hpThreshold: 40,
      attackDelayMin: 2000,
      attackDelayMax: 5000,
      moveDelay: 2000,
      comboDelay: 1500
    },
    stats: {
      kills: 0,
      credits: 0,
      fights: 0,
      items: {},
      enemies: []
    },
    logs: []
  });
});

// Слушаем сообщения от popup и content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    getSettings: () => {
      chrome.storage.local.get(['settings'], (result) => {
        sendResponse(result.settings || {});
      });
      return true;
    },
    saveSettings: () => {
      chrome.storage.local.set({ settings: request.data }, () => {
        sendResponse({ success: true });
      });
      return true;
    },
    getStats: () => {
      chrome.storage.local.get(['stats'], (result) => {
        sendResponse(result.stats || {});
      });
      return true;
    },
    getLogs: () => {
      chrome.storage.local.get(['logs'], (result) => {
        sendResponse(result.logs || []);
      });
      return true;
    },
    addLog: () => {
      chrome.storage.local.get(['logs'], (result) => {
        const logs = result.logs || [];
        logs.unshift({
          time: new Date().toLocaleTimeString(),
          level: request.level || 'INFO',
          message: request.message,
          data: request.data || {}
        });
        if (logs.length > 500) logs.pop();
        chrome.storage.local.set({ logs });
      });
      sendResponse({ success: true });
      return true;
    },
    clearLogs: () => {
      chrome.storage.local.set({ logs: [] }, () => {
        sendResponse({ success: true });
      });
      return true;
    },
    showNotification: () => {
      chrome.notifications.create({
        title: request.title || 'Game Bot',
        message: request.message,
        iconUrl: 'data:image/png;base64,...',
        type: 'basic'
      });
      sendResponse({ success: true });
      return true;
    }
  };
  
  const handler = handlers[request.action];
  if (handler) return handler();
});