# Відгуки про тата

Статична сторінка (GitHub Pages) + Google Таблиця як база відгуків через Apps Script.

**У репозиторії немає секретів.** PIN-коди зберігаються тільки в Script Properties скрипта на Google.
Адреса скрипта в `config.js` не є секретом: браузер однаково звертається за нею, а писати можна лише з PIN.

## 1. Таблиця і скрипт (один раз, ~5 хв)

1. Створи нову Google Таблицю, наприклад «Відгуки про тата».
2. Меню **Extensions → Apps Script**. Видали вміст `Code.gs` і встав код з `apps-script/Code.gs`. Збережи.
3. Шестерня **Project Settings → Script Properties → Add script property**:
   - `KID_PIN` — PIN для Натана (наприклад 4–6 цифр)
   - `OWNER_PIN` — твій PIN (інший!)
4. Угорі вибери функцію `setup` → **Run** → дозволь доступ до таблиці (Google попередить «unverified app» → Advanced → Go to …). З'явиться аркуш «Відгуки».
5. **Deploy → New deployment** → тип **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → Deploy → скопіюй **Web app URL** (закінчується на `/exec`).
6. Встав цю адресу в `config.js` замість `PASTE_YOUR_APPS_SCRIPT_URL_HERE`.

Якщо потім міняєш код скрипта: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (адреса лишається тією ж).

## 2. GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)` → Save.
Через хвилину сайт буде на `https://<username>.github.io/<repo>/`.

## Як користуватися

- **Натан:** «Написати відгук» → ім'я, зірочки, теги, текст, PIN. PIN запам'ятовується на його пристрої.
- **Тато:** внизу сторінки «Я тато» → свій PIN. З'являються кнопки «Відповісти» і «Приховати».
  Приховані відгуки лишаються в таблиці (колонка `hidden`), їх можна повернути, стерши «так».
- Після 15 неправильних PIN за 10 хвилин публікація блокується на 10 хвилин.
