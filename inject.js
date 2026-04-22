// inject.js - основная логика бота

(function() {
  "use strict";
  
  // ===== ПРОВЕРКА САЙТА =====
  if (!window.location.hostname.includes("league17.ru")) {
    console.log("GameBot: Работает только на league17.ru");
    return;
  }
  
  // ===== ПЕРЕМЕННЫЕ =====
  let simpleRules = {};
  let combos = [];
  let useComboMode = false;
  let auto = true;
  let healPath = "";
  let healPathBack = "";
  let healing = false;
  let healingInProgress = false;
  let lastAttackTime = 0;
  let fightStarted = false;
  let captchaPaused = false;
  let previousFightState = false;
  let lastSeenEnemyId = null;
  let lastSeenEnemyName = "";
  
  // COMBO VARIABLES
  let isExecutingCombo = false;
  
  // EXP SYSTEM
  let expConfig = { attack: "", swap: "", targetLevel: 0 };
  
  // STATS
  let stats = { kills: 0, credits: 0, fights: 0, items: {}, enemies: [] };
  let lastAlert = "";
  let attackCounter = {};
  
  // SETTINGS
  let hpThreshold = 40;
  let attackDelayMin = 2000;
  let attackDelayMax = 5000;
  let moveDelay = 2000;
  let comboDelay = 1500;
  let currentLocation = "";
  
  // Флаг для отслеживания необходимости лечения после лимита атак
  let needHealAfterLimit = false;
  
  // ===== ВСТРОЕННЫЕ ПУТИ ЛЕЧЕНИЯ =====
  const HEAL_TEMPLATES = {
    "Старый парк": { forward: ["btnGo529", "btnGo527", "btnGo335"], back: ["btnGo527", "btnGo529", "btnGo341"] },
    "Горный перевал": { forward: ["btnGo33", "btnGo35"], back: ["btnGo33", "btnGo32"] },
    "Крутой подъём": { forward: ["btnGo447", "btnGo653"], back: ["btnGo447", "btnGo448"] },
    "Лазурная заводь": { forward: ["btnGo483", "btnGo481", "btnGo485"], back: ["btnGo481", "btnGo483", "btnGo489"] },
    "Водопад": { forward: ["btnGo582", "btnGo581", "btnGo577", "btnGo576", "btnGo575", "btnGo574", "btnGo566", "btnGo567"], back: ["btnGo566", "btnGo574", "btnGo575", "btnGo576", "btnGo577", "btnGo581", "btnGo582", "btnGo583"] },
    "Коралловая лагуна": { forward: ["btnGo888", "btnGo527", "btnGo335"], back: ["btnGo527", "btnGo888", "btnGo889"] },
    "Место падения метеорита": { forward: ["btnGo507", "btnGo506", "btnGo414", "btnGo412", "btnGo473"], back: ["btnGo412", "btnGo414", "btnGo506", "btnGo507", "btnGo508"] },
    "Заброшенная шахта": { forward: ["btnGo583", "btnGo582", "btnGo581", "btnGo577", "btnGo576", "btnGo575", "btnGo574", "btnGo566", "btnGo567"], back: ["btnGo566", "btnGo574", "btnGo575", "btnGo576", "btnGo577", "btnGo581", "btnGo582", "btnGo583", "btnGo632"] },
    "Предгорье Синнабунга": { forward: ["btnGo795"], back: ["btnGo886"] },
    "Каменная площадка": { forward: ["btnGo720", "btnGo574", "btnGo566", "btnGo567"], back: ["btnGo566", "btnGo574", "btnGo720", "btnGo721"] },
    "Вулкан": { forward: ["btnGo581", "btnGo577", "btnGo576", "btnGo575", "btnGo574", "btnGo566", "btnGo567"], back: ["btnGo566", "btnGo574", "btnGo575", "btnGo576", "btnGo577", "btnGo581", "btnGo580"] },
    "Коралловая роща": { forward: ["btnGo332", "btnGo889", "btnGo888", "btnGo527", "btnGo335"], back: ["btnGo527", "btnGo888", "btnGo889", "btnGo332", "btnGo892"] },
    "Затопленный грот": { forward: ["btnGo332", "btnGo889", "btnGo888", "btnGo527", "btnGo335"], back: ["btnGo527", "btnGo888", "btnGo889", "btnGo332", "btnGo890"] },
    "Маршрут 16": { forward: ["btnGo482", "btnGo481", "btnGo485"], back: ["btnGo481", "btnGo482", "btnGo500"] },
    "Пастбище": { forward: ["btnGo468", "btnGo419", "btnGo457"], back: ["btnGo419", "btnGo468", "btnGo465"] },
    "Пасека": { forward: ["btnGo776", "btnGo59", "btnGo47", "btnGo50"], back: ["btnGo47", "btnGo59", "btnGo776", "btnGo779"] },
    "Пещера Потатов": { forward: ["btnGo796"], back: ["btnGo168"] },
    "Дорога №2": { forward: ["btnGo9", "btnGo1", "btnGo3"], back: ["btnGo1", "btnGo9", "btnGo18"] },
    "Лес вокруг воздушного стадиона": { forward: ["btnGo9", "btnGo1", "btnGo3"], back: ["btnGo1", "btnGo9", "btnGo7"] },
    "Лиственный подлесок": { forward: ["btnGo7", "btnGo9", "btnGo1", "btnGo3"], back: ["btnGo1", "btnGo9", "btnGo7", "btnGo450"] },
    "Безлюдная дорога": { forward: ["btnGo33", "btnGo35"], back: ["btnGo33", "btnGo42"] },
    "Заросшая тропа": { forward: ["btnGo33", "btnGo35"], back: ["btnGo33", "btnGo41"] },
    "Глухой колючий лес": { forward: ["btnGo41", "btnGo33", "btnGo35"], back: ["btnGo33", "btnGo41", "btnGo45"] }
  };
  
  // ===== ЛОГГЕР =====
  function log(message, type = 'INFO') {
    const time = new Date().toLocaleTimeString();
    const icons = { INFO: "📌", WARN: "⚠️", ERROR: "❌", FIGHT: "⚔️", HEAL: "🏥", MOVE: "🚶", COMBO: "🔥", RULE: "📋", SWAP: "🔄", EXP: "⭐" };
    console.log(`${icons[type] || "📌"} [${time}] ${message}`);
  }
  
  // ===== УПРАВЛЕНИЕ ДИКИМИ МОНСТРАМИ =====
  function setWildMonstersButton(enabled) {
    try {
      const btn = document.querySelector(".btnSwitchWilds");
      if (btn) {
        const isPressed = btn.classList.contains("pressed");
        if (enabled && !isPressed) {
          btn.click();
          log("Дикие монстры ВКЛЮЧЕНЫ", "HEAL");
        } else if (!enabled && isPressed) {
          btn.click();
          log("Дикие монстры ОТКЛЮЧЕНЫ", "HEAL");
        }
      }
    } catch(e) { log(`Ошибка: ${e}`, "ERROR"); }
  }
  
  // ===== ЗАГРУЗКА/СОХРАНЕНИЕ =====
  function loadData() {
    try {
      const data = localStorage.getItem('gamebot_data');
      if (data) {
        const parsed = JSON.parse(data);
        simpleRules = parsed.simpleRules || {};
        combos = parsed.combos || [];
        useComboMode = parsed.useComboMode || false;
        auto = parsed.auto ?? true;
        healPath = parsed.healPath || "";
        healPathBack = parsed.healPathBack || "";
        hpThreshold = parsed.hpThreshold ?? 40;
        attackDelayMin = parsed.attackDelayMin ?? 2000;
        attackDelayMax = parsed.attackDelayMax ?? 5000;
        moveDelay = parsed.moveDelay ?? 2000;
        comboDelay = parsed.comboDelay ?? 1500;
        expConfig = parsed.expConfig || { attack: "", swap: "", targetLevel: 0 };
        stats = parsed.stats || { kills: 0, credits: 0, fights: 0, items: {}, enemies: [] };
      }
    } catch(e) { log(`Ошибка загрузки: ${e}`, 'ERROR'); }
  }
  
  function saveData() {
    const data = {
      simpleRules, combos, useComboMode, auto,
      healPath, healPathBack, hpThreshold,
      attackDelayMin, attackDelayMax, moveDelay, comboDelay,
      expConfig, stats
    };
    localStorage.setItem('gamebot_data', JSON.stringify(data));
  }
  
  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function getAttackDelay() { return attackDelayMin + Math.random() * (attackDelayMax - attackDelayMin); }
  
  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
  function isInFight() {
    const enemyImg = document.querySelector("#divFightH img[src*='/mnst/']");
    if (!enemyImg) return false;

    const fightAction = document.querySelector("#divFightAction");
    if (fightAction?.textContent?.includes("Ваш ход")) return true;

    return getAttackElements().some(attack => {
      const pp = attack.querySelector(".divMoveParams")?.textContent;
      return pp?.includes("/");
    });
  }

  function extractMonsterIdFromSrc(src) {
    if (!src) return null;
    const match = src.match(/\/(\d+)(?:_.*)?\.(?:png|gif)(?:\?.*)?$/i);
    return match ? match[1] : null;
  }

  function updateCurrentEnemySnapshot() {
    const enemyImg = document.querySelector("#divFightH img[src*='/mnst/']");
    const enemyId = extractMonsterIdFromSrc(enemyImg?.src);
    if (enemyId) lastSeenEnemyId = enemyId;

    const nameEl = document.querySelector("#divFightH .name");
    const enemyName = nameEl?.textContent?.trim().toLowerCase() || "";
    if (enemyName) lastSeenEnemyName = enemyName;
  }

  function resetCurrentEnemySnapshot() {
    lastSeenEnemyId = null;
    lastSeenEnemyName = "";
  }
  
  function getEnemyId() {
    updateCurrentEnemySnapshot();
    return lastSeenEnemyId;
  }
  
  function getCurrentEnemy() {
    updateCurrentEnemySnapshot();
    return lastSeenEnemyName;
  }
  
  function getAttackElements() {
    return [...document.querySelectorAll("#divFightI .divMoveInfo.clickable")];
  }
  
  function getPP(index) {
    const attacks = getAttackElements();
    if (!attacks[index]) return 0;
    const match = attacks[index].querySelector(".divMoveParams")?.innerText?.match(/(\d+)\/\d+/);
    return match ? parseInt(match[1]) : 0;
  }
  
  function clickAttack(index) {
    if (!isInFight()) return false;
    const attacks = getAttackElements();
    if (attacks[index] && getPP(index) > 0) {
      attacks[index].click();
      lastAttackTime = Date.now();
      log(`⚔️ Атака ${index+1}`, 'FIGHT');
      return true;
    }
    return false;
  }
  
  function clickAttackByIndex(index) {
    const attacks = getAttackElements();
    if (attacks[index] && getPP(index) > 0) {
      attacks[index].click();
      lastAttackTime = Date.now();
      log(`⚔️ Атака ${index+1}`, 'FIGHT');
      return true;
    }
    return false;
  }
  
  // ===== СБОР ВЫПАВШИХ ПРЕДМЕТОВ =====
  function detectDrop() {
    const alerten = document.querySelector("#divAlerten .alerten");
    if (!alerten) return;
    
    const text = alerten.innerText;
    if (text === lastAlert) return;
    lastAlert = text;
    
    if (/разгромлен|побеждён|сражён|в нокауте|сокрушён|проиграл/i.test(text)) {
      const enemyName = getCurrentEnemy();
      const enemyId = getEnemyId();
      stats.kills++;
      stats.fights++;
      
      stats.enemies.unshift({ id: enemyId, name: enemyName, time: new Date().toLocaleTimeString() });
      if (stats.enemies.length > 50) stats.enemies.pop();
      
      log(`🏆 Победа над ${enemyName} (ID: ${enemyId})`, 'FIGHT');
      saveData();
    }
    
    const items = alerten.querySelectorAll(".item");
    items.forEach(item => {
      const title = item.querySelector(".title")?.innerText || "";
      const amount = parseInt(item.querySelector(".amount")?.innerText || "1") || 1;
      
      if (title.toLowerCase().includes("кредит")) {
        stats.credits += amount;
        log(`💰 +${amount} кредитов (всего: ${stats.credits})`, 'INFO');
      } else {
        const itemName = title.replace(/x\d+/i, "").trim();
        stats.items[itemName] = (stats.items[itemName] || 0) + amount;
        log(`📦 +${itemName} x${amount}`, 'INFO');
      }
      saveData();
    });
    
    updateUI();
  }
  
  // ===== ЛЕЧЕНИЕ =====
  function getHealPaths() {
    if (healPath?.trim()) {
      let clean = healPath.replace(/["']/g, '').replace(/[\[\]]/g, '').trim();
      let cleanBack = healPathBack?.replace(/["']/g, '').replace(/[\[\]]/g, '').trim() || "";
      if (clean) return { forward: clean, back: cleanBack };
    }
    if (currentLocation && HEAL_TEMPLATES[currentLocation]) {
      const t = HEAL_TEMPLATES[currentLocation];
      return { forward: t.forward.join(","), back: t.back.join(",") };
    }
    return null;
  }
  
  async function doHeal() {
    if (healingInProgress) return false;
    healingInProgress = true;
    log("=== ЗАПУСК ЛЕЧЕНИЯ ===", 'HEAL');
    
    // ОТКЛЮЧАЕМ ДИКИХ МОНСТРОВ
    setWildMonstersButton(false);
    
    const paths = getHealPaths();
    if (!paths?.forward) {
      log("Нет пути к лекарю!", 'ERROR');
      setWildMonstersButton(true);
      healingInProgress = false;
      return false;
    }
    
    await runPath(paths.forward);
    await delay(500);
    
    const healBtn = document.querySelector(".btnLocHeal");
    if (healBtn) { healBtn.click(); await delay(1000); }
    
    const healAllBtn = document.querySelector(".menuHealAll");
    if (healAllBtn) { healAllBtn.click(); await delay(2000); }
    
    if (paths.back) await runPath(paths.back);
    
    // ВКЛЮЧАЕМ ДИКИХ МОНСТРОВ ОБРАТНО
    setWildMonstersButton(true);
    
    healingInProgress = false;
    log("=== ЛЕЧЕНИЕ ЗАВЕРШЕНО ===", 'HEAL');
    return true;
  }
  
  function shouldHealNow() {
    const hpEl = document.querySelector("#divFightI .barHP div");
    if (hpEl) {
      const hp = parseFloat(hpEl.style.width);
      if (!isNaN(hp) && hp < hpThreshold) return true;
    }
    
    const moves = document.querySelectorAll("#divFightI .moveBox");
    for (const m of moves) {
      const match = m.querySelector(".divMoveParams")?.textContent?.match(/(\d+)\/\d+/);
      if (match && parseInt(match[1]) <= 0) return true;
    }
    return false;
  }
  
  async function clickButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return false;
    btn.click();
    await delay(moveDelay);
    return true;
  }
  
  async function runPath(pathString) {
    const buttons = pathString.split(",").map(s => s.trim()).filter(Boolean);
    for (const id of buttons) {
      if (!await clickButton(id)) return false;
    }
    return true;
  }

  async function waitFor(check, timeout = 3000, interval = 100) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      if (check()) return true;
      await delay(interval);
    }
    return check();
  }
  
  // ===== КОМБО СИСТЕМА =====
  async function performSwap(targetId) {
    const ball = document.querySelector("#divFightI .ball.clickable");
    if (!ball) return false;

    ball.click();

    const menuOpened = await waitFor(() => document.querySelectorAll(".divContext .pokemonBoxTiny").length > 0, 2000);
    if (!menuOpened) return false;

    const pokemons = document.querySelectorAll(".divContext .pokemonBoxTiny");
    let targetPokemon = null;
    for (const poke of pokemons) {
      const pokemonId = extractMonsterIdFromSrc(poke.querySelector("img")?.src);
      if (pokemonId === String(targetId)) {
        targetPokemon = poke;
        break;
      }
    }

    if (!targetPokemon) return false;

    targetPokemon.click();
    lastAttackTime = Date.now();

    await waitFor(() => document.querySelectorAll(".divContext .pokemonBoxTiny").length === 0, 3000);
    await delay(300);
    return true;
  }
  
  async function executeComboSequence(sequence) {
    if (!sequence?.length || isExecutingCombo) return false;
    isExecutingCombo = true;
    log(`🔥 Выполняем комбо (${sequence.length} действий)`, 'COMBO');

    try {
      for (const step of sequence) {
        if (step.type === "attack") {
          for (let r = 0; r < (step.count || 1); r++) {
            if (!clickAttack(step.index)) {
              log(`❌ Комбо прервано`, 'COMBO');
              return false;
            }
            if (r < (step.count || 1) - 1) await delay(comboDelay);
          }
          await delay(comboDelay);
        } else if (step.type === "swap") {
          const swapped = await performSwap(step.id);
          if (!swapped) {
            log(`❌ Смена на ID ${step.id} не выполнена`, 'COMBO');
            return false;
          }
          await delay(comboDelay);
        }
      }

      log(`✅ Комбо выполнено`, 'COMBO');
      return true;
    } finally {
      isExecutingCombo = false;
    }
  }
  
  function getComboForEnemy(enemyId) {
    if (!combos?.length) return null;
    return combos.find(c => c.enemy === String(enemyId))?.sequence || null;
  }
  
  // ===== ПРАВИЛА АТАК =====
  function attackByRules() {
    const enemy = getCurrentEnemy();
    const enemyId = getEnemyId();
    
    for (let i = 0; i < 4; i++) {
      const rule = simpleRules[i];
      if (!rule) continue;
      
      const countLimit = parseInt(rule.count) || 0;
      const against = (rule.against || "").trim().toLowerCase();
      const matchesEnemy = against && (enemy.includes(against) || String(enemyId || "") === against);
      
      if (countLimit > 0 && attackCounter[i] >= countLimit) continue;
      if (getPP(i) <= 0) continue;
      
      // Если указано имя или ID врага
      if (matchesEnemy) {
        if (clickAttack(i)) {
          attackCounter[i] = (attackCounter[i] || 0) + 1;
          log(`📋 Правило: атака ${i+1} против "${against}" (${attackCounter[i]}/${countLimit})`, 'RULE');
          
          if (countLimit > 0 && attackCounter[i] >= countLimit) {
            log(`🏥 Лимит атаки ${i+1} достигнут, требуется лечение`, 'HEAL');
            needHealAfterLimit = true;
          }
          return true;
        }
      }
      // Если имя не указано, но есть лимит - бьём всех подряд
      else if (!against && countLimit > 0 && attackCounter[i] < countLimit) {
        if (clickAttack(i)) {
          attackCounter[i] = (attackCounter[i] || 0) + 1;
          log(`📋 Лимит: атака ${i+1} (${attackCounter[i]}/${countLimit}) - бьём всех`, 'RULE');
          
          if (attackCounter[i] >= countLimit) {
            log(`🏥 Лимит атаки ${i+1} достигнут, требуется лечение`, 'HEAL');
            needHealAfterLimit = true;
          }
          return true;
        }
      }
    }
    return false;
  }
  
  function attackDefault() {
    for (let i = 0; i < 4; i++) {
      if (getPP(i) > 0 && clickAttack(i)) {
        log(`Обычная атака ${i+1}`, 'FIGHT');
        return true;
      }
    }
    return false;
  }
  
  function attack() {
    if (!isInFight()) return;
    if (isExecutingCombo) return;
    
    const enemyId = getEnemyId();
    
    // Проверка комбо (если включён режим)
    if (useComboMode && enemyId && !isExecutingCombo) {
      const comboSeq = getComboForEnemy(enemyId);
      if (comboSeq?.length) {
        executeComboSequence(comboSeq);
        return;
      }
    }
    
    // Проверка правил атак
    if (attackByRules()) return;
    
    // Обычная атака
    attackDefault();
  }
  
  // ===== ФУНКЦИЯ ДЛЯ ПРОВЕРКИ НУЖНО ЛИ ЛЕЧЕНИЕ ПОСЛЕ ЛИМИТА =====
  function checkAndHealAfterLimit() {
    if (needHealAfterLimit && !isInFight() && !healing && !healingInProgress) {
      log("🏥 Запускаем лечение после достижения лимита атак", 'HEAL');
      needHealAfterLimit = false;
      healing = true;
      doHeal().then(() => { healing = false; });
      return true;
    }
    return false;
  }
  
  // ===== UI =====
  function updateUI() {
    const killsEl = document.getElementById("gb-stats-kills");
    const creditsEl = document.getElementById("gb-stats-credits");
    const locEl = document.getElementById("gb-location");
    const modeEl = document.getElementById("gb-mode-status");
    const expEl = document.getElementById("gb-exp-status");
    
    if (killsEl) killsEl.textContent = stats.kills;
    if (creditsEl) creditsEl.textContent = stats.credits;
    if (locEl) locEl.textContent = currentLocation || "---";
    if (modeEl) modeEl.textContent = useComboMode ? "🔥 КОМБО" : "📋 ПРАВИЛА";
    if (expEl) {
      expEl.textContent = expConfig.targetLevel ? `⭐ Кач до ${expConfig.targetLevel} уровня` : "⭐ Автокач выключен";
      expEl.style.color = expConfig.targetLevel ? "#fbbf24" : "#888";
    }
  }
  
  function renderSimpleRules() {
    const wrap = document.getElementById("gb-rules-list");
    if (!wrap) return;
    wrap.innerHTML = '';

    const updateRule = (idx, field, value) => {
      if (!simpleRules[idx]) simpleRules[idx] = {};
      simpleRules[idx][field] = value;
      saveData();
    };

    for (let i = 0; i < 4; i++) {
      const rule = simpleRules[i] || { count: "", against: "" };
      const row = document.createElement("div");
      row.style.cssText = "display: flex; gap: 6px; margin-bottom: 8px; align-items: center;";
      row.innerHTML = `
        <div style="min-width: 50px; color:#4fa3f5;">Атака ${i+1}:</div>
        <input type="number" id="rule_count_${i}" placeholder="кол-во" value="${rule.count}" style="width:55px; padding:4px; background:#111; border:1px solid #555; color:#2ecc71; border-radius:4px;">
        <div style="color:#888;">→</div>
        <input type="text" id="rule_against_${i}" placeholder="имя или ID врага (пусто = все)" value="${rule.against}" style="flex:1; padding:4px; background:#111; border:1px solid #555; color:#f39c12; border-radius:4px;">
      `;
      wrap.appendChild(row);
      
      document.getElementById(`rule_count_${i}`).oninput = (idx => e => updateRule(idx, "count", e.target.value))(i);
      document.getElementById(`rule_count_${i}`).onchange = (idx => e => updateRule(idx, "count", e.target.value))(i);
      
      document.getElementById(`rule_against_${i}`).oninput = (idx => e => updateRule(idx, "against", e.target.value))(i);
      document.getElementById(`rule_against_${i}`).onchange = (idx => e => updateRule(idx, "against", e.target.value))(i);
    }
  }
  
  function renderComboList() {
    const wrap = document.getElementById("gb-combo-list");
    if (!wrap) return;
    wrap.innerHTML = '';
    
    for (let i = 0; i < 3; i++) {
      const combo = combos[i] || { enemy: "", sequence: [] };
      const card = document.createElement("div");
      card.style.cssText = "background:rgba(0,0,0,0.4); margin-bottom:12px; padding:8px; border-radius:8px; border-left:3px solid #f39c12;";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <b style="color:#f39c12;">КОМБО ${i+1}</b>
          <button class="gb-del-combo" data-index="${i}" style="background:#e74c3c; border:none; border-radius:3px; color:#fff; cursor:pointer; padding:2px 6px;">🗑️</button>
        </div>
        <input id="combo_enemy_${i}" placeholder="ID врага" value="${combo.enemy}" style="width:100%; padding:5px; margin-bottom:8px; background:#111; border:1px solid #f39c12; color:#f39c12; border-radius:4px;">
        <div style="color:#888; font-size:10px;">ПОСЛЕДОВАТЕЛЬНОСТЬ (задержка ${comboDelay}мс):</div>
        <div class="combo-actions-${i}" style="margin-bottom:5px;"></div>
        <button class="gb-add-action" data-index="${i}" style="width:100%; padding:4px; background:#4fa3f5; border:none; border-radius:4px; color:#fff; cursor:pointer;">+ ДОБАВИТЬ</button>
      `;
      wrap.appendChild(card);
      
      const actionsDiv = card.querySelector(`.combo-actions-${i}`);
      if (combo.sequence?.length) {
        combo.sequence.forEach(step => addComboActionRow(actionsDiv, step));
      }
      
      card.querySelector(`#combo_enemy_${i}`).oninput = () => saveComboSequence(i);
      card.querySelector(`.gb-add-action`).onclick = () => {
        addComboActionRow(actionsDiv, null);
        saveComboSequence(i);
      };
      card.querySelector(`.gb-del-combo`).onclick = () => {
        if (confirm(`Удалить комбо ${i+1}?`)) {
          combos[i] = { enemy: "", sequence: [] };
          saveData();
          renderComboList();
        }
      };
    }
  }
  
  function addComboActionRow(container, step) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:4px; margin-bottom:4px; align-items:center;";
    
    const select = document.createElement("select");
    select.style.cssText = "padding:3px; background:#111; border:1px solid #f39c12; color:#fff; border-radius:4px;";
    select.innerHTML = `<option value="attack" ${step?.type === "attack" ? "selected" : ""}>⚔️ Атака</option>
                        <option value="swap" ${step?.type === "swap" ? "selected" : ""}>🔄 Смена</option>`;
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = step?.type === "attack" ? "1-4" : "ID";
    input.value = step ? (step.type === "attack" ? step.index + 1 : step.id) : "";
    input.style.cssText = "width:45px; padding:3px; background:#111; border:1px solid #555; color:#4fa3f5; border-radius:4px;";
    
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.placeholder = "x";
    countInput.value = step?.count || 1;
    countInput.min = 1;
    countInput.max = 10;
    countInput.style.cssText = "width:45px; padding:3px; background:#111; border:1px solid #2ecc71; color:#2ecc71; border-radius:4px; text-align:center;";
    countInput.style.display = step?.type === "swap" ? "none" : "inline-block";
    
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = "padding:2px 6px; background:#e74c3c; border:none; border-radius:4px; color:#fff; cursor:pointer;";
    removeBtn.onclick = () => {
      row.remove();
      const idx = container.className.match(/\d+/)?.[0];
      if (idx) saveComboSequence(parseInt(idx));
    };
    
    select.onchange = () => {
      input.placeholder = select.value === "attack" ? "1-4" : "ID";
      input.value = "";
      countInput.style.display = select.value === "attack" ? "inline-block" : "none";
      const idx = container.className.match(/\d+/)?.[0];
      if (idx) saveComboSequence(parseInt(idx));
    };
    
    input.oninput = () => {
      const idx = container.className.match(/\d+/)?.[0];
      if (idx) saveComboSequence(parseInt(idx));
    };
    countInput.oninput = () => {
      const idx = container.className.match(/\d+/)?.[0];
      if (idx) saveComboSequence(parseInt(idx));
    };
    
    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(countInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }
  
  function saveComboSequence(comboIndex) {
    if (!combos[comboIndex]) combos[comboIndex] = { enemy: "", sequence: [] };
    
    const enemyInput = document.getElementById(`combo_enemy_${comboIndex}`);
    if (enemyInput) combos[comboIndex].enemy = enemyInput.value.trim();
    
    const actionsDiv = document.querySelector(`.combo-actions-${comboIndex}`);
    if (actionsDiv) {
      const sequence = [];
      actionsDiv.querySelectorAll("div").forEach(row => {
        const select = row.querySelector("select");
        const input = row.querySelector("input[type='text']");
        const countInput = row.querySelector("input[type='number']");
        if (select && input?.value.trim()) {
          if (select.value === "attack") {
            const idx = parseInt(input.value) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < 4) {
              sequence.push({ type: "attack", index: idx, count: parseInt(countInput?.value) || 1 });
            }
          } else if (select.value === "swap") {
            sequence.push({ type: "swap", id: input.value.trim() });
          }
        }
      });
      combos[comboIndex].sequence = sequence;
    }
    saveData();
  }
  
  function ensureExpUI() {
    const panel = document.getElementById("gb-simple-panel");
    if (!panel || document.getElementById("gb-exp-panel")) return;
    const div = document.createElement("div");
    div.id = "gb-exp-panel";
    div.style.marginTop = "10px";
    div.style.paddingTop = "8px";
    div.style.borderTop = "1px solid #fbbf24";
    div.innerHTML = `
      <label style="color:#fbbf24;">⭐ АВТОКАЧ (атака → ID → уровень):</label>
      <div style="display:flex; gap:6px; margin-top:5px;">
        <input id="gb-exp-attack" placeholder="атака" value="${expConfig.attack}" style="width:55px; padding:4px; background:#111; border:1px solid #fbbf24; color:#fbbf24; border-radius:4px;">
        <input id="gb-exp-swap" placeholder="ID покемона" value="${expConfig.swap}" style="flex:1; padding:4px; background:#111; border:1px solid #fbbf24; color:#fbbf24; border-radius:4px;">
        <input id="gb-exp-level" placeholder="цель" value="${expConfig.targetLevel}" style="width:55px; padding:4px; background:#111; border:1px solid #fbbf24; color:#fbbf24; border-radius:4px;">
      </div>
      <small>Бьёт атакой → проверяет уровень → при достижении цели останавливает бота</small>
    `;
    panel.appendChild(div);
    
    document.getElementById("gb-exp-attack").oninput = () => {
      expConfig.attack = document.getElementById("gb-exp-attack").value;
      saveData();
      updateUI();
    };
    document.getElementById("gb-exp-swap").oninput = () => {
      expConfig.swap = document.getElementById("gb-exp-swap").value;
      saveData();
    };
    document.getElementById("gb-exp-level").oninput = () => {
      expConfig.targetLevel = parseInt(document.getElementById("gb-exp-level").value) || 0;
      saveData();
      updateUI();
    };
  }
  
  function createSettingsPopup() {
    if (document.getElementById("gb-settings-popup")) return;
    const popup = document.createElement("div");
    popup.id = "gb-settings-popup";
    popup.style = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:400px; background:#1a1a2e; border:2px solid #4fa3f5; border-radius:12px;
      z-index:1000000; color:#fff; font-family:monospace; font-size:12px;
      box-shadow:0 0 30px rgba(0,0,0,0.8); display:none;
    `;
    popup.innerHTML = `
      <div style="padding:10px 12px; background:#0f0f1a; border-radius:10px 10px 0 0; display:flex; justify-content:space-between;">
        <b style="color:#4fa3f5;">⚙️ НАСТРОЙКИ</b>
        <button id="close-settings" style="background:none; border:none; color:#e74c3c; cursor:pointer;">✕</button>
      </div>
      <div style="padding:12px;">
        <div style="margin-bottom:12px;">
          <label style="color:#888;">🏥 ПУТЬ К ЛЕКАРЮ:</label>
          <input id="heal-path-input" value="${healPath}" style="width:100%; padding:5px; background:#111; border:1px solid #555; color:#2ecc71; border-radius:4px;">
          <small>btnGo483,btnGo481,btnGo485</small>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#888;">⬅ ПУТЬ ВОЗВРАТА:</label>
          <input id="heal-back-input" value="${healPathBack}" style="width:100%; padding:5px; background:#111; border:1px solid #555; color:#f39c12; border-radius:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#888;">💚 ПОРОГ HP: ${hpThreshold}%</label>
          <input id="hp-range" type="range" min="0" max="100" value="${hpThreshold}" style="width:100%;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#888;">⏱️ ЗАДЕРЖКИ АТАК (мс):</label>
          <div style="display:flex; gap:6px;">
            <input id="attack-min" value="${attackDelayMin}" style="flex:1; padding:4px; background:#111; border:1px solid #555; color:#2ecc71; border-radius:3px;">
            <input id="attack-max" value="${attackDelayMax}" style="flex:1; padding:4px; background:#111; border:1px solid #555; color:#f39c12; border-radius:3px;">
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#888;">🚶 ЗАДЕРЖКА ПЕРЕХОДОВ (мс):</label>
          <input id="move-delay" value="${moveDelay}" style="width:100%; padding:4px; background:#111; border:1px solid #555; color:#4fa3f5; border-radius:3px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#888;">🔥 ЗАДЕРЖКА КОМБО (мс):</label>
          <input id="combo-delay" value="${comboDelay}" style="width:100%; padding:4px; background:#111; border:1px solid #f39c12; color:#f39c12; border-radius:3px;">
        </div>
        <button id="save-settings" style="width:100%; padding:8px; background:#4fa3f5; border:none; border-radius:5px; color:#fff; cursor:pointer;">💾 СОХРАНИТЬ</button>
      </div>
    `;
    document.body.appendChild(popup);
    
    document.getElementById("close-settings").onclick = () => popup.style.display = "none";
    document.getElementById("save-settings").onclick = () => {
      healPath = document.getElementById("heal-path-input").value;
      healPathBack = document.getElementById("heal-back-input").value;
      hpThreshold = parseInt(document.getElementById("hp-range").value);
      attackDelayMin = parseInt(document.getElementById("attack-min").value);
      attackDelayMax = parseInt(document.getElementById("attack-max").value);
      moveDelay = parseInt(document.getElementById("move-delay").value);
      comboDelay = parseInt(document.getElementById("combo-delay").value);
      saveData();
      popup.style.display = "none";
      log("Настройки сохранены");
    };
    
    const hpRange = document.getElementById("hp-range");
    hpRange.oninput = () => hpRange.previousElementSibling.textContent = `💚 ПОРОГ HP: ${hpRange.value}%`;
  }
  
  function createUI() {
    if (document.getElementById("gb-main")) return;
    
    const c = document.createElement("div");
    c.id = "gb-main";
    c.style = `
      position:fixed; right:20px; bottom:20px; z-index:999999;
      width:380px; max-height:85vh; overflow-y:auto;
      background:linear-gradient(135deg,#1a1a2e,#16213e);
      border:2px solid #4fa3f5; border-radius:10px;
      font-family:monospace; font-size:12px;
      box-shadow:0 0 20px rgba(0,0,0,0.8);
    `;
    c.innerHTML = `
      <div id="gb-header" style="padding:8px 10px; background:#0f0f1a; border-bottom:1px solid #4fa3f5; display:flex; justify-content:space-between; cursor:move;">
        <b style="color:#4fa3f5;">🤖 GameBot v22.0</b>
        <button id="gb-minimize" style="background:none; border:none; color:#4fa3f5; cursor:pointer;">−</button>
      </div>
      <div id="gb-content" style="padding:10px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px;">
          <button id="gb-auto-btn" style="padding:8px; background:#2ecc71; border:none; border-radius:5px; color:#fff; cursor:pointer;">▶️ ON</button>
          <button id="gb-heal-btn" style="padding:8px; background:#f39c12; border:none; border-radius:5px; color:#fff; cursor:pointer;">🏥 HEAL</button>
          <button id="gb-settings-btn" style="padding:6px; background:#555; border:none; border-radius:5px; color:#fff; cursor:pointer;">⚙️ НАСТРОЙКИ</button>
          <button id="gb-mode-toggle" style="padding:6px; background:#9b59b6; border:none; border-radius:5px; color:#fff; cursor:pointer;">📋/🔥 РЕЖИМ</button>
        </div>
        
        <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:5px; margin-bottom:10px;">
          <div>🎯 Убийств: <span id="gb-stats-kills">0</span></div>
          <div>💰 Кредитов: <span id="gb-stats-credits">0</span></div>
          <div>📍 Локация: <span id="gb-location">---</span></div>
          <div>🎮 Режим: <span id="gb-mode-status">📋 ПРАВИЛА</span></div>
          <div>⭐ <span id="gb-exp-status">Автокач выключен</span></div>
        </div>
        
        <div id="gb-simple-panel">
          <label style="color:#888;">📋 ПРАВИЛА АТАК (кол-во → имя врага, пустое имя = бьём всех)</label>
          <div id="gb-rules-list" style="margin-top:6px;"></div>
        </div>
        
        <div id="gb-combo-panel" style="display:none;">
          <label style="color:#888;">🔥 КОМБО (задержка ${comboDelay}мс)</label>
          <div id="gb-combo-list" style="margin-top:6px; max-height:300px; overflow-y:auto;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(c);
    
    // Drag
    let dragging = false, startX, startY, startLeft, startTop;
    const header = c.querySelector("#gb-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = c.offsetLeft;
      startTop = c.offsetTop;
      c.style.left = startLeft + "px";
      c.style.right = "auto";
      c.style.top = startTop + "px";
      c.style.bottom = "auto";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      c.style.left = (startLeft + e.clientX - startX) + "px";
      c.style.top = (startTop + e.clientY - startY) + "px";
    });
    document.addEventListener("mouseup", () => dragging = false);
    
    // Buttons
    const autoBtn = c.querySelector("#gb-auto-btn");
    autoBtn.onclick = () => {
      auto = !auto;
      saveData();
      autoBtn.textContent = auto ? "▶️ ON" : "⏸️ OFF";
      autoBtn.style.background = auto ? "#2ecc71" : "#e74c3c";
      log(auto ? "Бот ВКЛЮЧЁН" : "Бот ВЫКЛЮЧЁН");
    };
    
    c.querySelector("#gb-heal-btn").onclick = () => { doHeal(); };
    c.querySelector("#gb-minimize").onclick = () => {
      const content = c.querySelector("#gb-content");
      content.style.display = content.style.display === "none" ? "block" : "none";
    };
    c.querySelector("#gb-settings-btn").onclick = () => {
      createSettingsPopup();
      document.getElementById("gb-settings-popup").style.display = "block";
    };
    
    const modeToggle = c.querySelector("#gb-mode-toggle");
    const simplePanel = c.querySelector("#gb-simple-panel");
    const comboPanel = c.querySelector("#gb-combo-panel");
    const modeStatus = c.querySelector("#gb-mode-status");
    
    modeToggle.onclick = () => {
      useComboMode = !useComboMode;
      saveData();
      if (useComboMode) {
        simplePanel.style.display = "none";
        comboPanel.style.display = "block";
        modeStatus.innerHTML = "🔥 КОМБО";
        modeToggle.style.background = "#e74c3c";
        renderComboList();
      } else {
        simplePanel.style.display = "block";
        comboPanel.style.display = "none";
        modeStatus.innerHTML = "📋 ПРАВИЛА";
        modeToggle.style.background = "#9b59b6";
        renderSimpleRules();
        ensureExpUI();
      }
    };
    
    renderSimpleRules();
    renderComboList();
    ensureExpUI();
    
    if (useComboMode) {
      simplePanel.style.display = "none";
      comboPanel.style.display = "block";
      modeStatus.innerHTML = "🔥 КОМБО";
      modeToggle.style.background = "#e74c3c";
    }
    
    updateUI();
  }
  
  // ===== ЛОКАЦИЯ =====
  function getCurrentLocation() {
    const el = document.querySelector("#divLocTitleText");
    if (el?.textContent) {
      const text = el.textContent.trim();
      if (text !== currentLocation) {
        currentLocation = text;
        log(`📍 Локация: ${currentLocation}`, 'INFO');
      }
      return currentLocation;
    }
    return currentLocation;
  }
  
  function checkCaptcha() {
    const hasCaptcha = !!document.querySelector("iframe[src*='captcha'], .captcha, #captcha");
    if (hasCaptcha && !captchaPaused) {
      captchaPaused = true;
      auto = false;
      log("⚠️ КАПЧА! Бот остановлен", 'ERROR');
      const autoBtn = document.getElementById("gb-auto-btn");
      if (autoBtn) { autoBtn.textContent = "⏸️ OFF"; autoBtn.style.background = "#e74c3c"; }
    } else if (!hasCaptcha) { captchaPaused = false; }
    return hasCaptcha;
  }
  
  // ===== ОСНОВНОЙ ЦИКЛ =====
  function mainLoop() {
    checkCaptcha();
    getCurrentLocation();
    if (!auto) return;

    updateCurrentEnemySnapshot();
    
    detectDrop();
    
    // Проверяем нужно ли лечение после достижения лимита
    checkAndHealAfterLimit();
    
    const inFight = isInFight();
    if (inFight !== previousFightState) {
      if (inFight) {
        resetCurrentEnemySnapshot();
        updateCurrentEnemySnapshot();
        lastAttackTime = Date.now();
        log("⚔️ НОВЫЙ БОЙ НАЧАЛСЯ!", 'FIGHT');
      } else {
        healing = false;
        healingInProgress = false;
        isExecutingCombo = false;
        log("✅ Бой завершён", 'FIGHT');
        resetCurrentEnemySnapshot();
      }
      previousFightState = inFight;
      updateUI();
    }
    
    if (!inFight) {
      if (!healing && !healingInProgress && shouldHealNow()) {
        healing = true;
        log("🏥 Требуется лечение!", 'HEAL');
        doHeal().then(() => { healing = false; });
      }
      return;
    }
    
    if (inFight && !healing && !healingInProgress) {
      const now = Date.now();
      if (now - lastAttackTime >= getAttackDelay()) {
        attack();
        updateUI();
      }
    }
  }
  
  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init() {
    console.log("%c🤖 GameBot v22.0 - Инициализация...", "color: #4fa3f5; font-size: 14px;");
    console.log("%c✨ Функции: правила атак, комбо, автокач, лечение", "color: #2ecc71; font-size: 12px");
    loadData();
    setInterval(createUI, 2000);
    setInterval(mainLoop, 500);
    console.log("%c✅ Бот готов!", "color: #2ecc71; font-size: 12px");
  }
  
  init();
})();