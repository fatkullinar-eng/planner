/* Планер — MVP по кейсу №2: задачи, состояние, подсказки, статистика.
   Без голосового помощника. Данные хранятся в localStorage. */

(() => {
  "use strict";

  const STORAGE_KEY = "planner-v1";

  const MOOD_LABELS = { 1: "Тяжело", 2: "Так себе", 3: "Нормально", 4: "Хорошо", 5: "Отлично" };
  const PRIORITY_LABELS = { low: "Низкий", normal: "Обычный", high: "Важный" };
  const PRIORITY_WEIGHT = { high: 0, normal: 1, low: 2 };

  const DEFAULT_LISTS = [
    { id: "work", name: "Работа", color: "#4f46e5" },
    { id: "home", name: "Дом", color: "#0ea5e9" },
    { id: "study", name: "Учёба", color: "#8b5cf6" },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));

  /* ---------- даты ---------- */

  function dateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, amount) {
    const date = parseKey(key);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  }

  function formatLong(date) {
    const text = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatShort(key) {
    if (!key) return "";
    return parseKey(key).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  function plural(n, forms) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  /* ---------- состояние ---------- */

  function seedState() {
    const today = dateKey();
    const task = (id, title, listId, priority, due, done, completedAt, note) => ({
      id, title, listId, priority, due, done, completedAt, note: note || "", createdAt: addDays(today, -10),
    });
    const moods = {};
    const moodValues = [3, 4, 5, 3, 2, 4, 5, 4, 3, 4, 2, 3];
    const stressValues = [3, 2, 2, 3, 4, 2, 1, 2, 3, 2, 4, 3];
    for (let i = 1; i <= 12; i += 1) {
      moods[addDays(today, -i)] = {
        mood: moodValues[i - 1],
        stress: stressValues[i - 1],
        note: i === 5 ? "Много встреч, устал" : "",
      };
    }
    return {
      version: 1,
      profile: { name: "" },
      theme: "light",
      lists: DEFAULT_LISTS.map((item) => ({ ...item })),
      moods,
      tasks: [
        task("t1", "Подготовить отчёт", "work", "high", today, false, null, "Свести цифры по продажам за неделю"),
        task("t2", "Позвонить в банк", "home", "normal", addDays(today, -1), false, null, ""),
        task("t3", "Прочитать главу", "study", "normal", addDays(today, 2), false, null, ""),
        task("t4", "Сдать документы", "work", "high", today, true, today, ""),
        task("t5", "Убрать на кухне", "home", "low", addDays(today, -1), true, addDays(today, -1), ""),
      ],
    };
  }

  function normalize(saved) {
    let lists = Array.isArray(saved.lists) && saved.lists.length
      ? saved.lists.filter((item) => item && item.id && item.name).map((item) => ({
        id: String(item.id),
        name: String(item.name),
        color: /^#[0-9a-fA-F]{3,8}$/.test(String(item.color || "")) ? item.color : "#4f46e5",
      }))
      : [];
    // Если после проверки не осталось ни одного списка — берём стандартные.
    if (!lists.length) lists = DEFAULT_LISTS.map((item) => ({ ...item }));

    const knownLists = new Set(lists.map((item) => item.id));
    const fallbackList = lists[0].id;

    const tasks = (Array.isArray(saved.tasks) ? saved.tasks : []).map((item) => ({
      id: item.id || "t" + Math.random().toString(36).slice(2, 9),
      title: String(item.title || "Без названия"),
      note: String(item.note || ""),
      listId: knownLists.has(item.listId) ? item.listId : fallbackList,
      priority: ["low", "normal", "high"].includes(item.priority) ? item.priority : "normal",
      due: typeof item.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : null,
      done: Boolean(item.done),
      completedAt: item.completedAt || null,
      createdAt: item.createdAt || dateKey(),
    }));

    const moods = {};
    if (saved.moods && typeof saved.moods === "object") {
      for (const [key, value] of Object.entries(saved.moods)) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
        moods[key] = {
          mood: Math.min(5, Math.max(1, Math.round(Number(value.mood) || 3))),
          stress: Math.min(5, Math.max(1, Math.round(Number(value.stress) || 3))),
          note: String(value.note || ""),
        };
      }
    }

    return {
      version: 1,
      profile: { name: saved.profile && typeof saved.profile.name === "string" ? saved.profile.name : "" },
      theme: saved.theme === "dark" ? "dark" : "light",
      lists,
      tasks,
      moods,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn("Не удалось прочитать данные:", error);
    }
    return seedState();
  }

  let state = loadState();
  let view = "today";
  let taskFilter = "all";
  let draftMood = null;
  let draftStress = null;
  let draftNote = null;
  let quickDraft = "";
  let lastRenderDate = dateKey();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Не удалось сохранить данные:", error);
    }
  }

  /* ---------- вычисления ---------- */

  const taskById = (id) => state.tasks.find((item) => item.id === id) || null;
  const listById = (id) => state.lists.find((item) => item.id === id) || state.lists[0];

  function isOverdue(task) {
    return !task.done && Boolean(task.due) && task.due < dateKey();
  }

  function completedOn(key) {
    return state.tasks.filter((task) => task.done && task.completedAt === key).length;
  }

  function sortTasks(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
  }

  function assistantTips() {
    const today = dateKey();
    const tips = [];
    const overdue = state.tasks.filter(isOverdue).sort((a, b) => (a.due < b.due ? -1 : 1));
    const openToday = state.tasks.filter((task) => task.due === today && !task.done);
    const doneToday = completedOn(today);
    const mood = state.moods[today];

    if (overdue.length) {
      tips.push(`Просрочено ${overdue.length} ${plural(overdue.length, ["задача", "задачи", "задач"])}. Начни с «${overdue[0].title}».`);
    }
    if (openToday.length) {
      tips.push(`На сегодня открыто ${openToday.length} ${plural(openToday.length, ["задача", "задачи", "задач"])}.`);
    }
    if (mood && mood.mood <= 2 && openToday.length >= 2) {
      tips.push("Настроение низкое. Выбери одну главную задачу, остальное перенеси.");
    }
    if (!mood) {
      tips.push("Отметь состояние за сегодня — так статистика будет точнее.");
    }
    if (doneToday) {
      tips.push(`Сегодня закрыто ${doneToday} ${plural(doneToday, ["задача", "задачи", "задач"])}.`);
    }
    if (!tips.length) {
      tips.push("На сегодня задач нет. Можно отдохнуть или запланировать новое.");
    }
    return tips.slice(0, 3);
  }

  /* ---------- отрисовка ---------- */

  const app = $("#app");
  const modalRoot = $("#modalRoot");

  function routeFromHash() {
    return (location.hash || "").replace(/^#\/?/, "").trim();
  }

  const ROUTES = ["today", "tasks", "mood", "stats", "settings"];

  function render() {
    let route = routeFromHash();
    if (!route) route = "today";
    if (!ROUTES.includes(route)) route = "404";
    view = route;
    lastRenderDate = dateKey();

    // Несохранённые черновики не должны переживать уход с экрана «Состояние».
    if (route !== "mood") {
      draftMood = null;
      draftStress = null;
      draftNote = null;
    }

    $$(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.view === view);
    });

    if (route === "today") app.innerHTML = renderToday();
    else if (route === "tasks") app.innerHTML = renderTasks();
    else if (route === "mood") app.innerHTML = renderMood();
    else if (route === "stats") app.innerHTML = renderStats();
    else if (route === "settings") app.innerHTML = renderSettings();
    else app.innerHTML = renderNotFound();

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function taskRow(task) {
    const list = listById(task.listId);
    const dueBadge = task.done
      ? `<span class="badge done">Выполнено</span>`
      : isOverdue(task)
        ? `<span class="badge overdue">Просрочено · ${formatShort(task.due)}</span>`
        : task.due === dateKey()
          ? `<span class="badge today">Сегодня</span>`
          : task.due
            ? `<span class="badge">${formatShort(task.due)}</span>`
            : `<span class="badge">Без срока</span>`;

    return `
      <div class="task-row prio-${task.priority} ${task.done ? "is-done" : ""}">
        <button class="check" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-pressed="${task.done}"
          aria-label="${task.done ? "Вернуть в работу" : "Выполнено"}: ${escapeHtml(task.title)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
        <div class="task-main">
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ""}
          <div class="task-meta">
            ${dueBadge}
            <span class="badge">${escapeHtml(list.name)}</span>
            <span class="badge">${PRIORITY_LABELS[task.priority]}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-sm" data-action="edit-task" data-id="${escapeHtml(task.id)}">Изменить</button>
        </div>
      </div>`;
  }

  function renderToday() {
    const today = dateKey();
    const dueToday = state.tasks.filter((task) => task.due === today);
    const doneToday = dueToday.filter((task) => task.done).length;
    const percent = dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : 0;
    const focus = state.tasks
      .filter((task) => !task.done && (task.due === today || isOverdue(task)))
      .sort(sortTasks);

    const hour = new Date().getHours();
    const greeting = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
    const namePart = state.profile.name ? ", " + escapeHtml(state.profile.name) : "";

    const mood = state.moods[today];
    const moodCard = mood
      ? `<div class="big">${mood.mood}/5</div>
         <p>${MOOD_LABELS[mood.mood]}, стресс ${mood.stress}/5.</p>
         <p><a class="link" href="#/mood">Изменить отметку</a></p>`
      : `<p>Отметь настроение и уровень стресса за сегодня.</p>
         <p><a class="btn btn-sm" href="#/mood">Отметить состояние</a></p>`;

    return `
      <div class="page-head">
        <h1>${greeting}${namePart}</h1>
        <p>${formatLong(new Date())}</p>
      </div>

      <div class="progress-card">
        <div class="progress-top">
          <strong>На сегодня ${doneToday} из ${dueToday.length}</strong>
          <span>${percent}%</span>
        </div>
        <div class="bar-track"><i style="width:${percent}%"></i></div>
      </div>

      <div class="section-title">Фокус дня</div>
      <div class="task-list">
        ${focus.length ? focus.map(taskRow).join("") : `<div class="empty">На сегодня и просроченных задач нет.</div>`}
      </div>

      <form class="quick-add" id="quickForm">
        <input name="title" maxlength="80" placeholder="Новая задача на сегодня" autocomplete="off" value="${escapeHtml(quickDraft)}" required>
        <button class="btn btn-primary" type="submit">Добавить</button>
      </form>

      <div class="grid" style="margin-top:22px">
        <div class="card">
          <h3>Состояние</h3>
          ${moodCard}
        </div>
        <div class="card">
          <h3>Подсказки</h3>
          <ul class="tips">
            ${assistantTips().map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
          </ul>
        </div>
      </div>`;
  }

  function renderTasks() {
    const today = dateKey();
    let list = state.tasks.slice().sort(sortTasks);
    if (taskFilter === "today") list = list.filter((task) => task.due === today);
    else if (taskFilter === "overdue") list = list.filter(isOverdue);
    else if (taskFilter === "done") list = list.filter((task) => task.done);
    else list = list.filter((task) => !task.done);

    return `
      <div class="page-head">
        <h1>Задачи</h1>
        <p>Всё, что запланировано и сделано</p>
      </div>

      <div class="chips">
        <button class="chip ${taskFilter === "all" ? "is-active" : ""}" data-action="filter" data-filter="all">Активные</button>
        <button class="chip ${taskFilter === "today" ? "is-active" : ""}" data-action="filter" data-filter="today">На сегодня</button>
        <button class="chip ${taskFilter === "overdue" ? "is-active" : ""}" data-action="filter" data-filter="overdue">Просроченные</button>
        <button class="chip ${taskFilter === "done" ? "is-active" : ""}" data-action="filter" data-filter="done">Выполненные</button>
      </div>

      <div class="task-list">
        ${list.length ? list.map(taskRow).join("") : `<div class="empty">Здесь пока пусто.</div>`}
      </div>

      <div class="row-buttons" style="margin-top:14px">
        <button class="btn btn-primary" data-action="new-task">Новая задача</button>
      </div>`;
  }

  function renderMood() {
    const today = dateKey();
    const current = state.moods[today] || null;
    const mood = draftMood !== null ? draftMood : current ? current.mood : null;
    const stress = draftStress !== null ? draftStress : current ? current.stress : null;
    const note = draftNote !== null ? draftNote : current ? current.note : "";

    const moodButtons = [1, 2, 3, 4, 5].map((value) => `
      <button type="button" class="mood-btn ${mood === value ? "is-active" : ""}" data-action="pick-mood" data-mood="${value}">
        <span class="dot"></span>${MOOD_LABELS[value]}
      </button>`).join("");

    const stressButtons = [1, 2, 3, 4, 5].map((value) => `
      <button type="button" class="stress-btn ${stress === value ? "is-active" : ""}" data-action="pick-stress" data-stress="${value}">${value}</button>`).join("");

    const history = Object.keys(state.moods)
      .sort()
      .reverse()
      .slice(0, 14)
      .map((key) => {
        const entry = state.moods[key];
        return `
          <div class="history-row">
            <span class="history-date">${key === today ? "Сегодня" : formatShort(key)}</span>
            <span class="history-note">${escapeHtml(entry.note || MOOD_LABELS[entry.mood])}</span>
            <span class="history-mood">${entry.mood}/5 · стресс ${entry.stress}</span>
          </div>`;
      })
      .join("");

    return `
      <div class="page-head">
        <h1>Состояние</h1>
        <p>Короткая отметка раз в день — и видно, как настроение связано с делами</p>
      </div>

      <div class="card">
        <form id="moodForm" class="mood-form">
          <div class="mood-row">
            <span class="mood-label">Настроение</span>
            <div class="mood-options" id="moodOptions">${moodButtons}</div>
          </div>
          <div class="mood-row">
            <span class="mood-label">Уровень стресса</span>
            <div class="stress-options" id="stressOptions">${stressButtons}</div>
          </div>
          <div class="field">
            <label for="moodNote">Заметка (необязательно)</label>
            <textarea id="moodNote" name="note" rows="2" maxlength="200" placeholder="Что повлияло на состояние">${escapeHtml(note)}</textarea>
          </div>
          <div class="row-buttons">
            <button class="btn btn-primary" type="submit">Сохранить отметку</button>
          </div>
        </form>
      </div>

      <div class="section-title">Последние отметки</div>
      <div class="history">
        ${history || `<div class="empty">Отметок пока нет.</div>`}
      </div>`;
  }

  function renderStats() {
    const today = dateKey();
    const total = state.tasks.length;
    const done = state.tasks.filter((task) => task.done).length;
    const overdue = state.tasks.filter(isOverdue).length;
    const moodDays = Object.keys(state.moods).length;

    let maxDone = 1;
    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const key = addDays(today, -i);
      const entry = state.moods[key] || null;
      const doneCount = completedOn(key);
      maxDone = Math.max(maxDone, doneCount);
      days.push({ key, mood: entry ? entry.mood : null, done: doneCount });
    }

    const chart = days.map((day) => {
      const moodHeight = day.mood ? Math.round((day.mood / 5) * 100) : 2;
      const doneHeight = Math.round((day.done / maxDone) * 100);
      return `
        <div class="chart-col">
          <div class="chart-bars">
            <i class="mood" style="height:${moodHeight}%" title="Настроение ${day.mood || "—"}"></i>
            <i class="tasks" style="height:${Math.max(doneHeight, 2)}%" title="Выполнено ${day.done}"></i>
          </div>
          <div class="chart-day">${parseKey(day.key).getDate()}</div>
        </div>`;
    }).join("");

    const listStats = state.lists.map((list) => {
      const listTasks = state.tasks.filter((task) => task.listId === list.id);
      const listDone = listTasks.filter((task) => task.done).length;
      const percent = listTasks.length ? Math.round((listDone / listTasks.length) * 100) : 0;
      return `
        <div class="list-stat-row">
          <div class="list-stat-head">
            <b>${escapeHtml(list.name)}</b>
            <span>${listDone} из ${listTasks.length}</span>
          </div>
          <div class="bar-track"><i style="width:${percent}%; background:${escapeHtml(list.color)}"></i></div>
        </div>`;
    }).join("");

    return `
      <div class="page-head">
        <h1>Статистика</h1>
        <p>Задачи, состояние и их связь</p>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="label">Всего задач</div><div class="value">${total}</div></div>
        <div class="stat"><div class="label">Выполнено</div><div class="value">${done}</div></div>
        <div class="stat"><div class="label">Просрочено</div><div class="value">${overdue}</div></div>
        <div class="stat"><div class="label">Дней с отметкой</div><div class="value">${moodDays}</div></div>
      </div>

      <div class="section-title">Настроение и задачи за 14 дней</div>
      <div class="card">
        <div class="chart">${chart}</div>
        <div class="legend">
          <span><i class="dot mood"></i> настроение</span>
          <span><i class="dot tasks"></i> выполненные задачи</span>
        </div>
      </div>

      <div class="section-title">По спискам</div>
      <div class="card">
        <div class="list-stat">${listStats}</div>
      </div>`;
  }

  function renderSettings() {
    return `
      <div class="page-head">
        <h1>Настройки</h1>
        <p>Профиль, тема и данные</p>
      </div>

      <div class="settings-block">
        <h2>Профиль</h2>
        <p>Имя показывается в приветствии на главной.</p>
        <div class="field">
          <label for="settingsName">Имя</label>
          <input id="settingsName" maxlength="30" value="${escapeHtml(state.profile.name)}" placeholder="Как тебя зовут">
        </div>
      </div>

      <div class="settings-block">
        <h2>Тема</h2>
        <p>Светлая и тёмная — переключаются кнопкой в шапке или здесь.</p>
        <div class="row-buttons">
          <button class="btn ${state.theme === "light" ? "btn-primary" : ""}" data-action="theme-light">Светлая</button>
          <button class="btn ${state.theme === "dark" ? "btn-primary" : ""}" data-action="theme-dark">Тёмная</button>
        </div>
      </div>

      <div class="settings-block">
        <h2>Данные</h2>
        <p>Всё хранится в этом браузере. Экспорт — резервная копия в файле JSON.</p>
        <div class="row-buttons">
          <button class="btn" data-action="export">Скачать данные</button>
          <button class="btn btn-danger" data-action="reset">Удалить все данные</button>
        </div>
      </div>

      <div class="settings-block">
        <h2>О приложении</h2>
        <p>Учебный MVP кейса №2: планировщик задач с дневником состояния. Без голосового помощника. Версия 1.0.</p>
        <p>Приложение можно установить на телефон: в браузере откройте меню и выберите «Установить приложение».</p>
      </div>`;
  }

  function renderNotFound() {
    return `
      <div class="page-head">
        <h1>404 — страница не найдена</h1>
        <p>Такого раздела нет или адрес введён с ошибкой.</p>
      </div>
      <div class="row-buttons">
        <a class="btn btn-primary" href="#/today">На главную</a>
      </div>`;
  }

  /* ---------- задачи: действия ---------- */

  let toastTimer = null;

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2200);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    save();
    render();
  }

  function toggleTask(id) {
    const task = taskById(id);
    if (!task) return;
    task.done = !task.done;
    task.completedAt = task.done ? dateKey() : null;
    save();
    render();
  }

  function addQuickTask(title) {
    state.tasks.push({
      id: "t" + Date.now().toString(36),
      title,
      note: "",
      listId: state.lists[0].id,
      priority: "normal",
      due: dateKey(),
      done: false,
      completedAt: null,
      createdAt: dateKey(),
    });
    quickDraft = "";
    save();
    render();
    toast("Задача добавлена");
  }

  function openTaskModal(id) {
    const editing = id ? taskById(id) : null;
    const draft = editing || {
      title: "", note: "", listId: state.lists[0].id, priority: "normal", due: dateKey(),
    };

    const listOptions = state.lists.map((list) => `
      <option value="${escapeHtml(list.id)}" ${list.id === draft.listId ? "selected" : ""}>${escapeHtml(list.name)}</option>`).join("");

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${editing ? "Редактирование задачи" : "Новая задача"}">
          <div class="modal-head">
            <h2>${editing ? "Редактирование" : "Новая задача"}</h2>
            <button class="icon-btn" data-action="close-modal" aria-label="Закрыть">×</button>
          </div>
          <form id="taskForm">
            <input type="hidden" name="taskId" value="${editing ? escapeHtml(editing.id) : ""}">
            <div class="field">
              <label for="taskTitle">Название</label>
              <input id="taskTitle" name="title" required maxlength="80" value="${escapeHtml(draft.title)}" placeholder="Что нужно сделать">
            </div>
            <div class="field">
              <label for="taskNote">Описание (необязательно)</label>
              <textarea id="taskNote" name="note" rows="2" maxlength="300">${escapeHtml(draft.note)}</textarea>
            </div>
            <div class="field">
              <label for="taskList">Список</label>
              <select id="taskList" name="listId">${listOptions}</select>
            </div>
            <div class="field">
              <label for="taskPriority">Приоритет</label>
              <select id="taskPriority" name="priority">
                <option value="low" ${draft.priority === "low" ? "selected" : ""}>Низкий</option>
                <option value="normal" ${draft.priority === "normal" ? "selected" : ""}>Обычный</option>
                <option value="high" ${draft.priority === "high" ? "selected" : ""}>Важный</option>
              </select>
            </div>
            <div class="field">
              <label for="taskDue">Срок</label>
              <input id="taskDue" name="due" type="date" value="${draft.due || ""}">
            </div>
            <div class="modal-actions">
              ${editing ? `<button type="button" class="btn btn-danger" data-action="delete-task" data-id="${escapeHtml(editing.id)}">Удалить</button>` : ""}
              <button type="button" class="btn" data-action="close-modal">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>`;

    setTimeout(() => { const input = $("#taskTitle"); if (input) input.focus(); }, 30);
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function submitTaskForm(form) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const id = String(data.get("taskId") || "");
    const payload = {
      title,
      note: String(data.get("note") || "").trim(),
      listId: String(data.get("listId") || state.lists[0].id),
      priority: String(data.get("priority") || "normal"),
      due: String(data.get("due") || "") || null,
    };

    if (id) {
      const task = taskById(id);
      if (task) Object.assign(task, payload);
      toast("Задача обновлена");
    } else {
      state.tasks.push({
        id: "t" + Date.now().toString(36),
        ...payload,
        done: false,
        completedAt: null,
        createdAt: dateKey(),
      });
      toast("Задача добавлена");
    }
    save();
    closeModal();
    render();
  }

  function deleteTask(id) {
    const task = taskById(id);
    if (!task) return;
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== id);
    save();
    closeModal();
    render();
    toast("Задача удалена");
  }

  function saveMood() {
    const today = dateKey();
    const current = state.moods[today] || null;
    const mood = draftMood !== null ? draftMood : current ? current.mood : null;
    const stress = draftStress !== null ? draftStress : current ? current.stress : null;
    const noteEl = $("#moodNote");
    const note = draftNote !== null
      ? draftNote.trim().slice(0, 200)
      : noteEl ? noteEl.value.trim().slice(0, 200) : "";

    if (!mood) {
      toast("Выберите настроение");
      return;
    }
    if (!stress) {
      toast("Выберите уровень стресса");
      return;
    }
    state.moods[today] = { mood, stress, note };
    draftMood = null;
    draftStress = null;
    draftNote = null;
    save();
    render();
    toast("Отметка сохранена");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `planner-${dateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast("Файл с данными сохранён");
  }

  function resetData() {
    if (!window.confirm("Удалить все задачи и отметки состояния? Это нельзя отменить.")) return;
    state.tasks = [];
    state.moods = {};
    draftMood = null;
    draftStress = null;
    draftNote = null;
    quickDraft = "";
    save();
    render();
    toast("Данные удалены");
  }

  /* ---------- события ---------- */

  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (tab) {
      const next = "#/" + tab.dataset.view;
      if (location.hash === next) render();
      else location.hash = next;
      return;
    }

    if (event.target.closest("#themeToggle")) {
      toggleTheme();
      return;
    }

    const overlay = event.target.closest(".modal-overlay");
    if (overlay && event.target === overlay) {
      closeModal();
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id, filter, mood, stress } = button.dataset;

    if (action === "toggle") toggleTask(id);
    else if (action === "edit-task") openTaskModal(id);
    else if (action === "delete-task") deleteTask(id);
    else if (action === "new-task") openTaskModal(null);
    else if (action === "close-modal") closeModal();
    else if (action === "filter") {
      taskFilter = filter;
      render();
    } else if (action === "pick-mood") {
      draftMood = Number(mood);
      $$(".mood-btn").forEach((el) => el.classList.toggle("is-active", Number(el.dataset.mood) === draftMood));
    } else if (action === "pick-stress") {
      draftStress = Number(stress);
      $$(".stress-btn").forEach((el) => el.classList.toggle("is-active", Number(el.dataset.stress) === draftStress));
    } else if (action === "theme-light") {
      state.theme = "light";
      applyTheme();
      save();
      render();
    } else if (action === "theme-dark") {
      state.theme = "dark";
      applyTheme();
      save();
      render();
    } else if (action === "export") exportData();
    else if (action === "reset") resetData();
  });

  document.addEventListener("submit", (event) => {
    const id = event.target.getAttribute("id");
    if (id === "quickForm") {
      event.preventDefault();
      const input = event.target.querySelector("input[name=title]");
      const title = (input.value || "").trim();
      if (title) addQuickTask(title);
      return;
    }
    if (id === "taskForm") {
      event.preventDefault();
      submitTaskForm(event.target);
      return;
    }
    if (id === "moodForm") {
      event.preventDefault();
      saveMood();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "settingsName") {
      state.profile.name = event.target.value.trim();
      save();
      toast("Имя сохранено");
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "moodNote") draftNote = event.target.value;
    if (event.target.id === "settingsName") {
      state.profile.name = event.target.value.trim();
      save();
    }
    if (event.target.matches('#quickForm input[name="title"]')) quickDraft = event.target.value;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  // Изменения в другой вкладке не должны затираться при следующем сохранении.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    applyTheme();
    render();
  });

  // Если вкладка простояла открытой до полуночи — показать новый день.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && dateKey() !== lastRenderDate) render();
  });

  window.addEventListener("hashchange", render);

  /* ---------- старт ---------- */

  applyTheme();

  if (!location.hash) location.hash = "#/today";
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch((error) => {
        console.warn("Service worker не зарегистрирован:", error);
      });
    });
  }
})();
