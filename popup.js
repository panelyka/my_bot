// popup.js - общается с background через chrome.runtime

async function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, data }, (response) => {
      resolve(response || {});
    });
  });
}

async function updateStats() {
  const stats = await sendMessage('getStats');
  const display = document.getElementById('stats-display');
  
  if (stats) {
    display.innerHTML = `
      <div class="stat">🎯 Побед: ${stats.kills || 0}</div>
      <div class="stat">💰 Кредитов: ${stats.credits || 0}</div>
      <div class="stat">⚔️ Боёв: ${stats.fights || 0}</div>
    `;
  } else {
    display.innerHTML = '<div class="stat">Игра не найдена</div>';
  }
  
  // Отображаем предметы
  const itemsDisplay = document.getElementById('items-display');
  if (stats?.items && Object.keys(stats.items).length > 0) {
    const items = Object.entries(stats.items).slice(-8).reverse();
    itemsDisplay.innerHTML = items.map(([name, count]) => 
      `<div class="stat">📦 ${name}: x${count}</div>`
    ).join('');
  } else {
    itemsDisplay.innerHTML = '<div class="stat">—</div>';
  }
  
  // Отображаем мобов
  const enemiesDisplay = document.getElementById('enemies-display');
  if (stats?.enemies && stats.enemies.length > 0) {
    const enemies = stats.enemies.slice(0, 8);
    enemiesDisplay.innerHTML = enemies.map(e => 
      `<div class="stat">👾 ${e.name || 'Неизвестный'} (${e.id || '?'})</div>`
    ).join('');
  } else {
    enemiesDisplay.innerHTML = '<div class="stat">—</div>';
  }
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

document.getElementById('view-logs').onclick = viewLogs;
document.getElementById('download-logs').onclick = downloadLogs;
document.getElementById('clear-logs').onclick = clearLogs;

updateStats();
setInterval(updateStats, 3000);