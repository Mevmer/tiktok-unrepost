// ==UserScript==
// @name         TikTok Unrepost — удалить все репосты
// @name:en      TikTok Unrepost — remove all reposts
// @namespace    https://github.com/Mevmer/tiktok-unrepost
// @version      4.0.2
// @description  Массово снимает все ваши репосты в веб-версии TikTok. Кнопка появляется на странице вашего профиля.
// @description:en Bulk-remove all of your reposts on TikTok web. A button appears on your profile page.
// @author       Mevmer
// @match        https://www.tiktok.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/Mevmer/tiktok-unrepost
// @supportURL   https://github.com/Mevmer/tiktok-unrepost/issues
// @downloadURL  https://raw.githubusercontent.com/Mevmer/tiktok-unrepost/main/tiktok-unrepost.user.js
// @updateURL    https://raw.githubusercontent.com/Mevmer/tiktok-unrepost/main/tiktok-unrepost.user.js
// ==/UserScript==

/*
 * TikTok Unrepost — массовое удаление репостов в веб-версии TikTok.
 *
 * Как запустить (любой из способов):
 *   1) Tampermonkey / Violentmonkey: установите скрипт, откройте свой профиль
 *      на tiktok.com и нажмите «Удалить репосты» на панели в правом нижнем углу.
 *   2) Консоль браузера: войдите в TikTok, F12 → Console, вставьте весь файл,
 *      нажмите Enter. Скрипт сам откроет профиль и вкладку «Репосты».
 *
 * Остановить: кнопка «Стоп» на панели или  tiktokUnrepost.stop()  в консоли.
 * Пробный запуск без нажатий:  tiktokUnrepost.start({ dryRun: true })
 *
 * Безопасность:
 *   • кнопка нажимается, только если она подписана «Удалить репост»
 *     (или видео помечено «Вы сделали репост»), результат сразу проверяется;
 *   • если после нажатия кнопка повела себя неожиданно, скрипт возвращает
 *     как было и останавливается;
 *   • никаких данных никуда не отправляется — скрипт только нажимает кнопки
 *     на странице, как это сделали бы вы.
 *
 * Почему несколько проходов: после снятия репоста TikTok сдвигает список,
 * и часть видео проскакивает. Поэтому скрипт сам начинает заново сверху,
 * пока вкладка «Репосты» не исчезнет (TikTok прячет её, когда репостов 0).
 */

(function () {
  'use strict';

  const VERSION = '4.0.2';
  const TAG = '[unrepost]';

  if (window.tiktokUnrepost && window.tiktokUnrepost.state && window.tiktokUnrepost.state.running) {
    console.warn(TAG, 'Уже работает. Остановить: tiktokUnrepost.stop()');
    return;
  }

  // ─────────────────────────── настройки ───────────────────────────
  const DEFAULTS = {
    delayMin: 2500,      // пауза между видео, мс (меньше ~1500 лучше не ставить)
    delayMax: 5000,
    maxPasses: 30,       // сколько раз пройти список заново сверху
    maxFailsInRow: 5,    // столько ошибок подряд — остановка
    cooldownMs: 60000,   // пауза, если TikTok перестал принимать нажатия
    limit: Infinity,     // максимум репостов за один запуск
    dryRun: false,       // true — ничего не нажимать, только показать
    dryRunCount: 5,      // сколько видео посмотреть в пробном режиме
    // служебное — можно направить скрипт на другую вкладку профиля для тестов
    tab: 'repost-tab',
    item: 'user-repost-item',
  };

  // Подпись кнопки, когда репост УЖЕ сделан («Удалить репост») — на разных языках
  const REMOVE_RE = new RegExp([
    '(remove|undo|delete)\\s+(the\\s+)?repost',
    '(удалить|убрать|отменить)\\s+(из\\s+)?репост',
    '(видалити|прибрати|скасувати)\\s+репост',
    '(quitar|eliminar|deshacer)\\b.{0,25}(repost|republica)',
    '(remover|desfazer|excluir)\\b.{0,25}(repost|republica)',
    'repost\\s+(entfernen|rückgängig)',
    '(supprimer|annuler)\\b.{0,25}(repost|republication)',
    '(rimuovi|annulla)\\b.{0,25}(repost|ripubblica)',
    '(usuń|cofnij)\\b.{0,25}(repost|udostępnienie)',
    'repost.{0,10}(kaldır|geri al)',
  ].join('|'), 'i');

  // Подпись, когда репоста НЕТ (просто «Репост»)
  const ADD_RE = /^\s*(repost|репост)\s*$/i;
  // Метка под описанием видео
  const BADGE_RE = /(вы\s+сделали\s+репост|you\s+reposted|ви\s+зробили\s+репост)/i;
  // Кнопка «Изменить профиль» — есть только в своём профиле
  const EDIT_RE = /(edit\s+profile|изменить\s+профиль|редагувати\s+профіль|editar\s+perfil|profil\s+bearbeiten|modifier\s+le\s+profil|modifica\s+profilo|edytuj\s+profil|profili\s+düzenle)/i;
  // Кнопка подтверждения, если TikTok вдруг спросит
  const CONFIRM_RE = /^(remove|delete|confirm|ok|yes|убрать|удалить|подтвердить|ок|да)$/i;

  // Несколько вариантов для каждого элемента: если TikTok переименует один,
  // сработает следующий.
  const SEL = {
    navProfile: ['a[data-e2e="nav-profile"]', '[data-e2e="nav-profile"] a', '[data-e2e="nav-profile"]'],
    editProfile: ['[data-e2e="edit-profile-entrance"]', '[data-e2e="edit-profile"]'],
    videosTab: ['[data-e2e="videos-tab"]'],
    repostIcon: [
      '[data-e2e="video-share-repost"]',
      '[data-e2e="browse-share-repost"]',
      '[data-e2e*="share-repost" i]:not([data-e2e="share-repost"])',
    ],
    repostMenu: ['[data-e2e="share-repost"]'],
    shareOpen: [
      '[data-e2e="share-icon"]',
      '[data-e2e="browse-share-icon"]',
      'button[data-e2e="share-btn"]',
    ],
    next: [
      'button[data-e2e="arrow-right"]',
      '[data-e2e="arrow-right"]',
      'button[aria-label*="След" i]',
      'button[aria-label*="Next" i]',
    ],
    close: [
      'button[data-e2e="browse-close"]',
      '[data-e2e="browse-close"]',
      'button[aria-label*="Закрыть" i]',
      'button[aria-label*="Close" i]',
    ],
    badge: ['[class*="RepostText"]'],
  };

  // ─────────────────────────── утилиты ───────────────────────────
  let cfg = { ...DEFAULTS };
  const state = {
    running: false, stopped: false, fatal: null,
    pass: 0, removed: 0, skipped: 0, failed: 0,
    last: '', log: [],
  };

  const IS_USERSCRIPT = typeof GM_info !== 'undefined';
  const RESUME_KEY = 'tt-unrepost-resume';
  const HIDE_KEY = 'tt-unrepost-hidden';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => Math.round(a + Math.random() * (b - a));

  async function pause(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end && !state.stopped) await sleep(Math.min(250, end - Date.now()));
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }

  function all(sel) {
    try { return [...document.querySelectorAll(sel)]; } catch (e) { return []; }
  }

  function first(sels) {
    for (const s of [].concat(sels)) {
      const el = all(s).find(visible);
      if (el) return el;
    }
    return null;
  }

  const labelOf = el => !el ? '' :
    [el.getAttribute('aria-label'), el.getAttribute('title'), el.innerText]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const clickTarget = el =>
    el && (el.closest('a, button, [role="button"], [role="tab"], [role="menuitem"]') || el);

  async function waitFor(fn, timeout = 4000, step = 150) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (state.stopped) return null;
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  function log(msg, level = 'log') {
    state.last = msg;
    state.log.push(new Date().toLocaleTimeString() + '  ' + msg);
    if (state.log.length > 300) state.log.shift();
    console[level]('%c' + TAG + ' ' + msg, 'color:#c084fc');
    ui.update();
  }

  // Нажатие для вкладок/навигации: обычный click, а если не сработал —
  // полная последовательность событий мыши.
  async function clickAndWait(el, check, timeout = 4000) {
    el = clickTarget(el);
    if (!el) return false;
    el.click();
    if (await waitFor(check, timeout)) return true;
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true, cancelable: true, view: window, button: 0,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    };
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const E = t.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      el.dispatchEvent(new E(t, o));
    }
    return !!(await waitFor(check, timeout));
  }

  // ─────────────────────────── навигация ───────────────────────────
  // Ники с кириллицей, пробелами и т.п. браузер и TikTok кодируют по-разному
  // («/@злой» и «/@%D0%B7…», «%d0» и «%D0», абсолютная и относительная ссылка),
  // поэтому пути сравниваем только после приведения к одному виду.
  function normPath(href) {
    if (!href) return null;
    let p;
    try { p = new URL(href, location.href).pathname; } catch (e) { p = String(href).split(/[?#]/)[0]; }
    try { p = decodeURIComponent(p); } catch (e) { /* битая последовательность — сравниваем как есть */ }
    return p.normalize('NFC').replace(/\s+/g, ' ').replace(/\/+$/, '').toLowerCase();
  }

  // Ник вошедшего пользователя из данных, которые TikTok кладёт в страницу.
  let handleCache = null;
  function ownHandle() {
    if (handleCache) return handleCache;
    try {
      const data = JSON.parse(document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__').textContent);
      const user = data.__DEFAULT_SCOPE__['webapp.app-context'].user;
      handleCache = (user && user.uniqueId) || null;
    } catch (e) { /* данных нет — обойдёмся ссылкой из меню */ }
    return handleCache;
  }

  function ownPaths() {
    const a = first(SEL.navProfile);
    const href = a && (a.getAttribute('href') || (a.querySelector('a') || {}).getAttribute?.('href'));
    const id = ownHandle();
    return [href, id && '/@' + id].map(normPath).filter(Boolean);
  }

  const inViewer = () => !!first(SEL.close) && /\/(video|photo)\//.test(location.pathname);

  // Кнопка «Изменить профиль» есть только в своём профиле — запасной признак,
  // если путь всё-таки не совпал.
  function editProfileVisible() {
    return !!first(SEL.editProfile) || all('button').some(b => visible(b) && EDIT_RE.test(labelOf(b)));
  }

  function onOwnProfile() {
    if (inViewer() || !/^\/@[^/]+\/?$/.test(location.pathname)) return false;
    return ownPaths().includes(normPath(location.href)) || editProfileVisible();
  }

  // Ссылка на свой профиль: из меню TikTok, а если её нет — любая на странице.
  function profileLink() {
    const nav = first(SEL.navProfile);
    if (nav) return nav;
    const own = ownPaths();
    return own.length ? all('a[href*="/@"]').find(a => visible(a) && own.includes(normPath(a.getAttribute('href')))) : null;
  }

  async function closeViewer() {
    if (!inViewer()) return true;
    const btn = first(SEL.close);
    if (btn) await clickAndWait(btn, () => !inViewer(), 4000);
    if (inViewer()) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      await waitFor(() => !inViewer(), 3000);
    }
    if (inViewer()) {
      history.back();
      await waitFor(() => !inViewer(), 4000);
    }
    return !inViewer();
  }

  // Открыть свой профиль → вкладку «Репосты». Возвращает первый элемент списка.
  async function openList(refresh) {
    await closeViewer();

    if (!onOwnProfile()) {
      const nav = profileLink();
      if (!nav) return { error: 'Не нашёл ссылку на ваш профиль. Войдите в аккаунт на tiktok.com и запустите снова.' };
      await clickAndWait(nav, onOwnProfile, 8000);
      if (!onOwnProfile()) return { error: 'Не получилось открыть ваш профиль. Откройте его вручную и запустите снова.' };
    }

    // ждём, пока загрузятся вкладки профиля
    if (!(await waitFor(() => first(SEL.videosTab) || first('[role="tab"]'), 15000))) {
      return { error: 'Профиль не загрузился. Обновите страницу и запустите снова.' };
    }

    // TikTok показывает вкладку «Репосты», только если репосты есть
    const tabSel = '[data-e2e="' + cfg.tab + '"]';
    if (!(await waitFor(() => first(tabSel), 4000))) return { done: true };

    if (refresh) {
      const vt = first(SEL.videosTab);
      if (vt) {
        await clickAndWait(vt, () => (first(SEL.videosTab) || {}).getAttribute?.('aria-selected') === 'true', 3000);
        await sleep(1000);
      }
    }

    const tab = await waitFor(() => first(tabSel), 4000);
    if (!tab) return { done: true };
    const itemSel = '[data-e2e="' + cfg.item + '"]';
    await clickAndWait(tab, () => first(itemSel), 10000);
    const item = await waitFor(() => first(itemSel), 4000);
    if (!item) return { done: true };
    return { item };
  }

  async function goNext() {
    for (let attempt = 0; attempt < 2; attempt++) {
      const btn = first(SEL.next);
      if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
        if (attempt === 0) { await pause(2500); continue; }
        return false;
      }
      const before = location.href;
      clickTarget(btn).click();
      if (await waitFor(() => location.href !== before, 6000)) return true;
      await pause(2000);
    }
    return false;
  }

  // ─────────────────────────── репост ───────────────────────────
  const repostControl = () => first(SEL.repostIcon) || first(SEL.repostMenu);

  // Панель с кнопками уже показывает ТЕКУЩЕЕ видео, а не предыдущее?
  // (после перехода на следующее видео TikTok обновляет её не мгновенно).
  // true — да; false — нет; 'unknown' — проверить нечем.
  function panelFresh() {
    const id = (location.pathname.match(/\/(?:video|photo)\/(\d+)/) || [])[1];
    if (!id) return 'unknown';
    const marks = all('[data-e2e="browse-video-link"], [data-e2e^="video-share-"][href]').filter(visible);
    if (!marks.length) return 'unknown';
    return marks.some(el => (el.textContent || '').includes(id) || (el.getAttribute('href') || '').includes(id));
  }

  function badgeVisible() {
    if (all(SEL.badge.join(',')).some(visible)) return true;
    const root = document.querySelector('[role="dialog"]') || document;
    return [...root.querySelectorAll('span, p')]
      .some(el => el.childElementCount === 0 && BADGE_RE.test(el.textContent || '') && visible(el));
  }

  // Сделан ли репост на текущем видео. Возвращает 'label' | 'badge' | false.
  function repostedBy() {
    const c = repostControl();
    const label = labelOf(c);
    if (c && REMOVE_RE.test(label)) return 'label';
    if (c && ADD_RE.test(label)) return false;   // явно «Репост» — значит репоста нет
    return badgeVisible() ? 'badge' : false;
  }

  async function openShareMenu() {
    const midY = innerHeight / 2;
    const btns = SEL.shareOpen.flatMap(all).filter(visible);
    if (!btns.length) return null;
    btns.sort((a, b) =>
      Math.abs(a.getBoundingClientRect().top - midY) - Math.abs(b.getBoundingClientRect().top - midY));
    clickTarget(btns[0]).click();
    return waitFor(() => first(SEL.repostMenu) || first(SEL.repostIcon), 3000);
  }

  async function confirmIfAsked(before) {
    const fresh = all('[role="dialog"], [role="alertdialog"]').filter(d => !before.has(d) && visible(d));
    for (const d of fresh) {
      const btn = [...d.querySelectorAll('button, [role="button"]')]
        .find(b => visible(b) && CONFIRM_RE.test(labelOf(b)));
      if (btn) { btn.click(); await sleep(600); return true; }
    }
    return false;
  }

  async function handleCurrent() {
    const ready = await waitFor(() => repostControl() || first(SEL.shareOpen), 8000);
    if (!ready) return { kind: 'fail', why: 'не дождался панели с кнопками' };

    // Не нажимаем, пока панель не переключилась на текущее видео — иначе можно
    // принять состояние кнопки от предыдущего ролика за состояние этого.
    if (!(await waitFor(() => panelFresh() === true, 6000))) {
      if (panelFresh() === false) return { kind: 'fail', why: 'панель не обновилась под текущее видео' };
      await sleep(1500); // проверить нечем — просто даём странице время
    }
    await sleep(300);
    await waitFor(repostedBy, 2500); // подпись кнопки иногда обновляется с задержкой

    let ctrl = repostControl();
    if (!ctrl) ctrl = await openShareMenu();
    if (!ctrl) {
      return { kind: 'fail', why: badgeVisible() ? 'видео в репостах, но кнопку не нашёл' : 'не нашёл кнопку репоста' };
    }

    const basis = repostedBy();
    if (!basis) return { kind: 'skip', why: 'репоста нет (кнопка: «' + (labelOf(ctrl) || '—') + '»)' };
    if (cfg.dryRun) return { kind: 'dry' };

    ctrl = repostControl() || ctrl;
    const labelBefore = labelOf(ctrl);
    const before = new Set(all('[role="dialog"], [role="alertdialog"]'));
    clickTarget(ctrl).click();

    let ok = await waitFor(() => !repostedBy(), 3000);
    if (!ok && (await confirmIfAsked(before))) ok = await waitFor(() => !repostedBy(), 3000);
    if (ok) return { kind: 'ok' };

    // Страховка: если решение принималось только по метке, а кнопка
    // переключилась «не туда» — нажимаем ещё раз, чтобы вернуть как было.
    const after = repostControl();
    if (basis === 'badge' && after && labelOf(after) !== labelBefore) {
      clickTarget(after).click();
      await sleep(1500);
      return { kind: 'fatal', why: 'кнопка повела себя неожиданно — вернул как было' };
    }
    return { kind: 'fail', why: 'нажал, но репост не снялся' };
  }

  // ─────────────────────────── диагностика ───────────────────────────
  let diagShown = false;
  function dumpDiag(reason) {
    if (diagShown) return;
    diagShown = true;
    const short = (s, n = 40) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const out = {
      version: VERSION,
      reason,
      // без имён пользователей и ID видео
      path: location.pathname.replace(/\/@[^/]+/, '/@…').replace(/\/(video|photo)\/\d+/, '/$1/…'),
      lang: document.documentElement.lang,
      inViewer: inViewer(),
      panelFresh: panelFresh(),
      elements: all('[data-e2e]').filter(visible)
        .filter(el => /share|repost|arrow|close|browse|tab/i.test(el.dataset.e2e))
        .filter(el => !/user|name|nick|desc|comment|avatar|link|author|title/i.test(el.dataset.e2e))
        .slice(0, 40)
        .map(el => el.tagName.toLowerCase() + ' [' + el.dataset.e2e + '] ' + short(el.getAttribute('aria-label'))),
    };
    const text = JSON.stringify(out, null, 1);
    console.log(TAG + ' диагностика (приложите к issue на GitHub):\n' + text);
    try { if (typeof copy === 'function') copy(text); } catch (e) { /* не в консоли */ }
  }

  // ─────────────────────────── основной цикл ───────────────────────────
  function finish(msg, level = 'log') {
    log(msg, level);
    log('Итого: снято ' + state.removed + ', пропущено ' + state.skipped + ', ошибок ' + state.failed + '.');
  }

  async function runPass() {
    let removed = 0, skipped = 0, fails = 0, seen = 0;
    while (!state.stopped && state.removed < cfg.limit) {
      await sleep(500);
      const r = await handleCurrent();
      const where = location.pathname;
      seen++;
      if (r.kind === 'ok') {
        removed++; state.removed++; fails = 0;
        log('✓ ' + state.removed + ' — ' + where);
      } else if (r.kind === 'dry') {
        removed++;
        log('(пробный режим) снял бы репост: ' + where);
      } else if (r.kind === 'skip') {
        skipped++; state.skipped++;
        log('– ' + where + ': ' + r.why);
      } else {
        state.failed++; fails++;
        log('✗ ' + where + ': ' + r.why + ' (' + fails + '/' + cfg.maxFailsInRow + ')', 'warn');
        dumpDiag(r.why);
        if (r.kind === 'fatal' || fails >= cfg.maxFailsInRow) {
          state.fatal = r.why;
          break;
        }
        if (fails >= 2) {
          log('Похоже, TikTok притормаживает. Жду ' + Math.round(cfg.cooldownMs / 1000) + ' с…');
          await pause(cfg.cooldownMs);
        }
      }
      if (state.stopped || state.removed >= cfg.limit) break;
      if (cfg.dryRun && seen >= cfg.dryRunCount) break;
      await pause(rand(cfg.delayMin, cfg.delayMax));
      if (!(await goNext())) break;
    }
    return { removed, skipped };
  }

  async function main(resumed) {
    for (let pass = state.pass + 1; pass <= cfg.maxPasses; pass++) {
      if (state.stopped) return finish('Остановлено.');
      state.pass = pass;
      ui.update();

      const list = await openList(pass > 1 && !resumed);
      resumed = false;
      if (state.stopped) return finish('Остановлено.');
      if (list.error) return finish(list.error, 'warn');
      if (list.done) {
        return finish(state.removed || state.pass > 1
          ? 'Готово! Репостов больше нет — вкладка «Репосты» исчезла.'
          : 'Репостов не найдено — вкладки «Репосты» в профиле нет.');
      }

      log('Проход ' + pass + ': открываю список репостов…');
      const link = list.item.querySelector('a[href]') || list.item;
      await clickAndWait(link, inViewer, 10000);
      if (!inViewer()) return finish('Не получилось открыть видео из списка.', 'warn');

      const res = await runPass();
      if (state.stopped) return finish('Остановлено.');
      if (state.fatal) {
        return finish('Остановился: ' + state.fatal + '. Диагностика — в консоли (F12), приложите её к issue на GitHub.', 'warn');
      }
      if (state.removed >= cfg.limit) return finish('Достигнут лимит (' + cfg.limit + ').');
      if (cfg.dryRun) return finish('Пробный режим: проверено ' + (res.removed + res.skipped) + ' видео, ничего не нажато.');
      if (res.removed === 0) {
        return finish(res.skipped
          ? 'В списке остались видео, на которых репоста уже нет (обычно удалённые или скрытые). Обновите страницу и проверьте вкладку «Репосты».'
          : 'Проход ничего не снял — останавливаюсь.', 'warn');
      }

      log('Проход ' + pass + ' закончен: снято ' + res.removed + '. Начинаю сверху — TikTok иногда проскакивает видео.');
      if (IS_USERSCRIPT) {
        // В режиме userscript перезагружаем страницу, чтобы список точно был свежим,
        // и продолжаем автоматически.
        await closeViewer();
        try {
          sessionStorage.setItem(RESUME_KEY, JSON.stringify({
            t: Date.now(), cfg: { ...cfg, limit: cfg.limit === Infinity ? null : cfg.limit },
            pass: state.pass, removed: state.removed, skipped: state.skipped, failed: state.failed,
          }));
          location.reload();
          return;
        } catch (e) { /* без sessionStorage просто продолжаем без перезагрузки */ }
      }
    }
    finish('Достигнут лимит проходов (' + cfg.maxPasses + ').', 'warn');
  }

  async function start(opts = {}) {
    if (state.running) { log('Уже работает.'); return; }
    const resume = opts._resume;
    delete opts._resume;
    cfg = { ...DEFAULTS, ...opts };
    if (cfg.limit == null) cfg.limit = Infinity;
    Object.assign(state, {
      running: true, stopped: false, fatal: null,
      pass: resume ? resume.pass : 0,
      removed: resume ? resume.removed : 0,
      skipped: resume ? resume.skipped : 0,
      failed: resume ? resume.failed : 0,
    });
    diagShown = false;
    ui.ensure();
    log(resume
      ? 'Продолжаю после обновления страницы…'
      : 'Старт v' + VERSION + (cfg.dryRun ? ' (пробный режим — ничего не нажимаю)' : ''));
    try {
      await main(!!resume);
    } catch (e) {
      log('Ошибка: ' + (e && e.message || e), 'error');
      console.error(e);
    } finally {
      state.running = false;
      ui.update();
    }
  }

  function stop() {
    if (!state.running) return;
    state.stopped = true;
    try { sessionStorage.removeItem(RESUME_KEY); } catch (e) { /* ignore */ }
    log('Останавливаюсь…');
  }

  // ─────────────────────────── панель ───────────────────────────
  // Собирается через createElement (без innerHTML), чтобы не мешали политики CSP.
  const ui = {
    root: null, els: {},
    ensure() {
      if (this.root && this.root.isConnected) { this.root.style.display = ''; return; }
      const mk = (tag, css, text) => {
        const e = document.createElement(tag);
        if (css) e.style.cssText = css;
        if (text != null) e.textContent = text;
        return e;
      };
      const btnCss = 'flex:1;padding:7px 10px;border:0;border-radius:8px;font:600 12px system-ui,sans-serif;cursor:pointer;';
      const root = mk('div',
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:280px;max-width:calc(100vw - 32px);' +
        'padding:12px 14px;border-radius:12px;background:#121212;color:#f1f1f1;border:1px solid #2c2c2c;' +
        'font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5)');
      root.id = 'tt-unrepost-panel';
      const head = mk('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px');
      head.append(mk('b', null, 'TikTok Unrepost'), mk('span', 'opacity:.5;font-size:11px', 'v' + VERSION));
      const stats = mk('div', 'font-variant-numeric:tabular-nums');
      const last = mk('div', 'opacity:.7;font-size:12px;margin-top:4px;word-break:break-word;max-height:54px;overflow:hidden');
      const row = mk('div', 'display:flex;gap:8px;margin-top:10px');
      const startBtn = mk('button', btnCss + 'background:#fe2c55;color:#fff', 'Удалить репосты');
      const stopBtn = mk('button', btnCss + 'background:#2f2f2f;color:#fff', 'Стоп');
      const hideBtn = mk('button', 'padding:7px 10px;border:0;border-radius:8px;background:#2f2f2f;color:#aaa;cursor:pointer', '✕');
      hideBtn.title = 'Скрыть панель';
      startBtn.onclick = () => start();
      stopBtn.onclick = () => stop();
      hideBtn.onclick = () => {
        if (state.running) stop();
        root.style.display = 'none';
        try { sessionStorage.setItem(HIDE_KEY, '1'); } catch (e) { /* ignore */ }
      };
      row.append(startBtn, stopBtn, hideBtn);
      root.append(head, stats, last, row);
      document.body.appendChild(root);
      this.root = root;
      this.els = { stats, last, startBtn, stopBtn };
      this.update();
    },
    update() {
      if (!this.root) return;
      const { stats, last, startBtn, stopBtn } = this.els;
      stats.textContent = state.running || state.removed || state.pass
        ? 'Снято: ' + state.removed + (state.pass ? ' · проход ' + state.pass : '') +
          (state.skipped ? ' · пропущено ' + state.skipped : '') +
          (state.failed ? ' · ошибок ' + state.failed : '')
        : 'Откройте свой профиль и нажмите кнопку.';
      last.textContent = state.last || '';
      startBtn.style.display = state.running ? 'none' : '';
      stopBtn.style.display = state.running ? '' : 'none';
    },
  };

  // ─────────────────────────── запуск ───────────────────────────
  window.tiktokUnrepost = { start, stop, state, version: VERSION, defaults: DEFAULTS };
  window.stopUnrepost = stop; // совместимость со старыми версиями

  if (IS_USERSCRIPT) {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null');
      sessionStorage.removeItem(RESUME_KEY);
    } catch (e) { saved = null; }

    if (saved && Date.now() - saved.t < 10 * 60 * 1000) {
      waitFor(() => first(SEL.navProfile) || ownHandle(), 30000)
        .then(() => start({ ...saved.cfg, _resume: saved }));
    }

    // Показываем панель на странице своего профиля (TikTok — одностраничное
    // приложение, поэтому проверяем периодически).
    setInterval(() => {
      let hidden = false;
      try { hidden = sessionStorage.getItem(HIDE_KEY) === '1'; } catch (e) { /* ignore */ }
      if (state.running || (!hidden && onOwnProfile())) ui.ensure();
      else if (ui.root && !state.running) ui.root.style.display = 'none';
    }, 1500);
  } else if (!window.__TT_UNREPOST_NO_AUTOSTART) {
    // Вставлено в консоль — запускаемся сразу.
    start();
  }
})();
