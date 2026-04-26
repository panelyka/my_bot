// popup.js - общается с background через chrome.runtime

async function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, data }, (response) => {
      resolve(response || {});
    });
  });
}

let currentStats = null;

function getDropItemsTotal(items = {}) {
  return Object.values(items).reduce((total, amount) => total + (parseInt(amount, 10) || 0), 0);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function openDropsModal() {
  const modal = document.getElementById('drops-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeDropsModal() {
  const modal = document.getElementById('drops-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function renderRecentDrops(stats) {
  const history = document.getElementById('drops-history');
  const recentDrops = Array.isArray(stats?.recentDrops) ? stats.recentDrops : [];

  if (!recentDrops.length) {
    history.innerHTML = '<div class="stat">История выпадений пока пуста</div>';
    return;
  }

  history.innerHTML = recentDrops.map((drop) => {
    const title = drop.type === 'credits'
      ? `💰 Кредиты: +${drop.amount || 0}`
      : `📦 ${escapeHtml(drop.name || 'Предмет')} x${drop.amount || 0}`;
    const source = drop.enemyName || drop.enemyId
      ? `Источник: ${escapeHtml(drop.enemyName || 'Неизвестный')} ${drop.enemyId ? `(${escapeHtml(drop.enemyId)})` : ''}`
      : 'Источник: не указан';
    const time = drop.time ? `Время: ${escapeHtml(drop.time)}` : 'Время: —';

    return `
      <div class="drop-entry">
        <div class="drop-entry-title">${title}</div>
        <div class="drop-entry-meta">${time}</div>
        <div class="drop-entry-meta">${source}</div>
      </div>
    `;
  }).join('');
}

function applyStats(stats) {
  currentStats = stats && Object.keys(stats).length ? stats : null;
  const display = document.getElementById('stats-display');
  
  if (currentStats) {
    display.innerHTML = `
      <div class="stat">🎯 Побед: ${currentStats.kills || 0}</div>
      <div class="stat">💰 Кредитов: ${currentStats.credits || 0}</div>
      <div class="stat stat-clickable" data-action="show-drops" tabindex="0">📦 Вещей: ${getDropItemsTotal(currentStats.items || {})}<span class="stat-hint">Нажмите, чтобы открыть последние выпадения</span></div>
      <div class="stat">⚔️ Боёв: ${currentStats.fights || 0}</div>
    `;
  } else {
    display.innerHTML = '<div class="stat">Игра не найдена</div>';
  }
  
  const itemsDisplay = document.getElementById('items-display');
  if (currentStats?.items && Object.keys(currentStats.items).length > 0) {
    const items = Object.entries(currentStats.items).slice(-8).reverse();
    itemsDisplay.innerHTML = items.map(([name, count]) => 
      `<div class="stat">📦 ${escapeHtml(name)}: x${count}</div>`
    ).join('');
  } else {
    itemsDisplay.innerHTML = '<div class="stat">—</div>';
  }
  
  const enemiesDisplay = document.getElementById('enemies-display');
  if (currentStats?.enemies && currentStats.enemies.length > 0) {
    const enemies = currentStats.enemies.slice(0, 8);
    enemiesDisplay.innerHTML = enemies.map(e => 
      `<div class="stat">👾 ${escapeHtml(e.name || 'Неизвестный')} (${escapeHtml(e.id || '?')})</div>`
    ).join('');
  } else {
    enemiesDisplay.innerHTML = '<div class="stat">—</div>';
  }

  renderRecentDrops(currentStats);
}

async function updateStats() {
  const stats = await sendMessage('getStats');
  applyStats(stats);
}

async function viewLogs() {
  const logs = await sendMessage('getLogs');
  if (logs && logs.length > 0) {
    console.clear();
    console.log("%c=== GAME BOT LOGS ===", "color: #4fa3f5; font-size: 16px; font-weight: bold;");
    logs.forEach(log => {
      const colors = { 'INFO': '#2ecc71', 'WARN': '#f39c12', 'ERROR': '#e74c3c', 'FIGHT': '#e74c3c', 'HEAL': '#2ecc71', 'COMBO': '#f39c12' };
      const color = colors[log.level] || '#fff';
      console.log(`%c[${log.time}] ${log.level}: ${log.message}`, `color: ${color}; font-weight: bold;`);
      if (log.data && Object.keys(log.data).length > 0) console.log(log.data);
    });
    alert(`✓ Логов: ${logs.length}`);
  } else {
    alert('Логов нет');
  }
}

async function downloadLogs() {
  const logs = await sendMessage('getLogs');
  if (logs && logs.length > 0) {
    const logText = logs.map(log => `[${log.time}] ${log.level}: ${log.message}\n`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✓ Логи скачаны');
  } else {
    alert('Логов нет');
  }
}

async function clearLogs() {
  if (confirm('Очистить все логи?')) {
    await sendMessage('clearLogs');
    alert('Логи очищены');
  }
}

async function resetStats() {
  if (!confirm('Сбросить убийства и дроп? Кредиты и количество боёв останутся.')) return;

  const response = await sendMessage('resetStats');
  if (!response?.success) {
    alert('Не удалось сбросить статистику. Откройте вкладку игры и попробуйте снова.');
    return;
  }

  await updateStats();
  alert('Убийства и дроп сброшены');
}

async function resetAllStats() {
  if (!confirm('Сбросить всю статистику? Будут очищены убийства, дроп, кредиты и бои.')) return;

  const response = await sendMessage('resetAllStats');
  if (!response?.success) {
    alert('Не удалось полностью сбросить статистику. Откройте вкладку игры и попробуйте снова.');
    return;
  }

  await updateStats();
  alert('Вся статистика сброшена');
}

document.getElementById('stats-display').addEventListener('click', (event) => {
  if (event.target.closest('[data-action="show-drops"]')) {
    openDropsModal();
  }
});

document.getElementById('stats-display').addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-action="show-drops"]')) {
    event.preventDefault();
    openDropsModal();
  }
});

document.getElementById('close-drops-modal').onclick = closeDropsModal;
document.getElementById('drops-modal-backdrop').onclick = closeDropsModal;

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.stats) return;
  applyStats(changes.stats.newValue || null);
});

document.getElementById('view-logs').onclick = viewLogs;
document.getElementById('download-logs').onclick = downloadLogs;
document.getElementById('clear-logs').onclick = clearLogs;
document.getElementById('reset-stats').onclick = resetStats;
document.getElementById('reset-all-stats').onclick = resetAllStats;

updateStats();