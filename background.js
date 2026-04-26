// Service Worker для расширения
const GAME_HOSTS = new Set(['game.league17.ru', 'eu.league17.ru', 'league17.ru']);
const MAX_RECENT_DROPS = 30;

function normalizeRecentDrop(source = {}) {
  return {
    type: source.type === 'credits' ? 'credits' : 'item',
    name: String(source.name || (source.type === 'credits' ? 'Кредиты' : '')),
    amount: Number(source.amount) || 0,
    time: String(source.time || ''),
    enemyId: source.enemyId ? String(source.enemyId) : '',
    enemyName: String(source.enemyName || '')
  };
}

function createStatsSnapshot(source = {}) {
  return {
    kills: Number(source.kills) || 0,
    credits: Number(source.credits) || 0,
    fights: Number(source.fights) || 0,
    items: source.items && typeof source.items === 'object' ? { ...source.items } : {},
    enemies: Array.isArray(source.enemies) ? [...source.enemies] : [],
    recentDrops: Array.isArray(source.recentDrops)
      ? source.recentDrops.slice(0, MAX_RECENT_DROPS).map(normalizeRecentDrop)
      : []
  };
}

let cachedStats = createStatsSnapshot();

chrome.storage.local.get(['stats'], (result) => {
  cachedStats = createStatsSnapshot(result.stats || {});
});

function isGameUrl(url) {
  try {
    return GAME_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function withActiveGameTab(callback) {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = (tabs || []).find(item => isGameUrl(item.url));
    callback(tab || null);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Game Bot Extension installed");
  const initialStats = createStatsSnapshot();
  cachedStats = initialStats;
  
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
    stats: initialStats,
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
      sendResponse(createStatsSnapshot(cachedStats));
      return false;
    },
    syncStats: () => {
      const nextStats = createStatsSnapshot(request.data?.stats || {});
      cachedStats = nextStats;
      chrome.storage.local.set({ stats: nextStats }, () => {
        sendResponse({ success: true, stats: nextStats });
      });
      return true;
    },
    resetStats: () => {
      withActiveGameTab((tab) => {
        if (!tab?.id) {
          sendResponse({ success: false, error: 'active-game-tab-not-found' });
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'resetStats' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          sendResponse(response || { success: true });
        });
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