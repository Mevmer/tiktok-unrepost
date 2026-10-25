# TikTok Unrepost

Удаляет **все ваши репосты в TikTok** одной кнопкой: прямо в браузере, без паролей, без сторонних сервисов и подписок.

В самом TikTok нет кнопки «удалить все репосты», их приходится снимать по одному. Этот скрипт делает то же самое за вас: открывает каждое видео из вкладки «Репосты» и нажимает «Удалить репост».

> 🇬🇧 English version is [below](#english).

---

## Установка

### 🌟 Вариант 1: Букмарклет (работает везде!)

**📖 Подробная инструкция:** откройте [**bookmark-install.html**](bookmark-install.html) в браузере. Там вы сможете:
- **Скопировать букмарклет одной кнопкой** (работает на всех браузерах и устройствах)
- Увидеть пошаговые инструкции для вашего браузера (Chrome, Firefox, Safari, Edge)
- Как установить на ПК и Android

**Быстро:**
1. Откройте [bookmark-install.html](bookmark-install.html) в браузере
2. Нажмите кнопку **"Скопировать букмарклет"**
3. Создайте новую закладку в браузере и вставьте код в поле URL
4. Откройте свой профиль на [tiktok.com](https://www.tiktok.com)
5. Нажмите на закладку → готово!

✅ **Работает на:** Chrome, Firefox, Edge, Brave (ПК и Android)  
❌ **Не работает на:** Safari (iOS) — ограничение Apple

---

### Вариант 2: Tampermonkey (рекомендуется для ПК)

1. Установите расширение [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Opera) или [Violentmonkey](https://violentmonkey.github.io/).
2. Откройте ссылку **[tiktok-unrepost.user.js](https://raw.githubusercontent.com/Mevmer/tiktok-unrepost/main/tiktok-unrepost.user.js)** и нажмите «Установить».
3. Зайдите на [tiktok.com](https://www.tiktok.com), откройте **свой профиль**. В правом нижнем углу появится панель.
4. Нажмите **«Удалить репосты»**.

---

### Вариант 3: без расширений, через консоль

1. Войдите в свой аккаунт на [tiktok.com](https://www.tiktok.com) в Chrome на компьютере.
2. Нажмите **F12** (или **Ctrl+Shift+J**) и откройте вкладку **Console**.
3. Скопируйте всё содержимое файла [`tiktok-unrepost.user.js`](tiktok-unrepost.user.js), вставьте в консоль и нажмите **Enter**.
   - Если Chrome не даёт вставить, один раз наберите вручную `allow pasting` и нажмите Enter.
4. Скрипт сам откроет ваш профиль и вкладку «Репосты» и начнёт работу.

---

## Как пользоваться

- **Остановить:** кнопка «Стоп» на панели или `tiktokUnrepost.stop()` в консоли.
- **Пробный запуск** (ничего не нажимает, только показывает, что сделал бы): `tiktokUnrepost.start({ dryRun: true })`.
- Пока скрипт работает, не закрывайте вкладку и не кликайте по странице.
- Скрипт делает паузу 2,5–5 секунд между видео, чтобы TikTok не ограничивал действия. Сотня репостов снимается примерно за 7 минут.

### Почему скрипт проходит список несколько раз

Когда репост снимается, TikTok сдвигает список, и часть видео проскакивает. Поэтому после каждого прохода скрипт начинает заново сверху. Он останавливается, когда вкладка «Репосты» исчезает из профиля: TikTok прячет её, когда репостов не осталось.

### В мобильном приложении репосты ещё видны?

Это кэш. Потяните профиль вниз, чтобы обновить, или перезапустите приложение.

---

## Безопасность

- Скрипт нажимает кнопку, **только если она подписана «Удалить репост»** (или видео помечено «Вы сделали репост»), и сразу проверяет результат. Видео без вашего репоста пропускаются.
- Если после нажатия кнопка повела себя неожиданно, скрипт возвращает всё как было и останавливается.
- Скрипт **ничего никуда не отправляет** и не просит пароль. Он только нажимает кнопки на странице, как это сделали бы вы. Код открыт, его можно прочитать целиком.
- Перед вставкой любого кода в консоль убедитесь, что он взят из этого репозитория.

---

## Если перестал работать

TikTok иногда меняет вёрстку сайта. Скрипт ищет каждую кнопку несколькими способами и работает с русским и английским интерфейсом (и ещё рядом языков), но если что-то всё же сломалось:

1. Откройте консоль (F12 → Console). При ошибке скрипт выводит туда блок **«диагностика»** и копирует его в буфер обмена.
2. Создайте [issue](https://github.com/Mevmer/tiktok-unrepost/issues) и вставьте эту диагностику. В ней нет личных данных: только названия кнопок на странице.

---

## Важно

Это неофициальный инструмент, он никак не связан с TikTok. Автоматизация действий может противоречить правилам TikTok. Пользуйтесь на свой страх и риск и не уменьшайте паузы между действиями.

---

## Лицензия

[MIT](LICENSE)

---

<a id="english"></a>

## English

**TikTok Unrepost** removes **all of your TikTok reposts** in bulk, right in your browser: no passwords, no third-party services, no subscriptions.

TikTok has no "remove all reposts" button, so you normally have to undo them one by one. This script does exactly that for you: it opens every video in your Reposts tab and clicks "Remove repost".

### Install

**Option 1: Bookmarklet (works everywhere!)**

**📖 Full instructions:** open [**bookmark-install.html**](bookmark-install.html) in your browser to:
- **Copy bookmarklet with one click** (works on all browsers and devices)
- See step-by-step instructions for your browser (Chrome, Firefox, Safari, Edge)
- Learn how to install on desktop and Android

**Quick start:**
1. Open [bookmark-install.html](bookmark-install.html)
2. Click **"Copy bookmarklet"**
3. Create a new bookmark in your browser and paste the code into the URL field
4. Go to your profile on [tiktok.com](https://www.tiktok.com)
5. Click the bookmark → done!

✅ **Works on:** Chrome, Firefox, Edge, Brave (desktop and Android)  
❌ **Doesn't work on:** Safari (iOS) — Apple limitation

---

**Option 2: Tampermonkey (recommended for desktop)**

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open **[tiktok-unrepost.user.js](https://raw.githubusercontent.com/Mevmer/tiktok-unrepost/main/tiktok-unrepost.user.js)** and click "Install".
3. Go to [tiktok.com](https://www.tiktok.com) and open **your profile**. A panel appears in the bottom-right corner.
4. Click the red button to start.

---

**Option 3: browser console**

1. Log in at [tiktok.com](https://www.tiktok.com) in desktop Chrome.
2. Press **F12** (or **Ctrl+Shift+J**) and open **Console**.
3. Paste the whole content of [`tiktok-unrepost.user.js`](tiktok-unrepost.user.js) and press **Enter**. If Chrome blocks pasting, type `allow pasting` once.
4. The script opens your profile and the Reposts tab by itself.

---

### Usage

- **Stop:** the "Stop" button on the panel or `tiktokUnrepost.stop()` in the console.
- **Dry run** (clicks nothing, just shows what it would do): `tiktokUnrepost.start({ dryRun: true })`.
- Keep the tab open while it works. There is a 2.5–5 s pause between videos to avoid rate limits.
- The script makes several passes, because TikTok skips some videos when the list shifts. It stops when the Reposts tab disappears from your profile, which TikTok does when you have zero reposts.

---

### Safety

- It clicks only when the button says "Remove repost" (or the video is marked "You reposted") and checks the result right away. Videos you didn't repost are skipped.
- If the button behaves unexpectedly, it reverts the change and stops.
- It sends no data anywhere and never asks for a password. It only clicks buttons on the page.

---

### If it breaks

TikTok changes its layout from time to time. On an error the script prints a **diagnostics** block to the console (and copies it to the clipboard). Please open an [issue](https://github.com/Mevmer/tiktok-unrepost/issues) and paste it. It contains no personal data, only button names.

---

### Disclaimer

Unofficial tool, not affiliated with TikTok. Automating actions may go against TikTok's terms. Use at your own risk and don't lower the delays.

---

### License

[MIT](LICENSE)
