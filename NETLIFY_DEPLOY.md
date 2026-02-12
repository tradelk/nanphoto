# Как установить и запустить nanphoto на Netlify

Пошаговая инструкция для деплоя на [app.netlify.com](https://app.netlify.com/).

---

## Шаг 1. Убедитесь, что проект на GitHub

- Репозиторий **nanphoto** должен быть на GitHub.
- Если ещё не залили: откройте терминал в папке проекта и выполните:
  ```bash
  cd /home/workshopai/nanphoto
  git remote -v
  ```
  Если `origin` нет — добавьте его и запушьте:
  ```bash
  git remote add origin https://github.com/ВАШ_ЛОГИН/nanphoto.git
  git push -u origin main
  ```

---

## Шаг 2. Войдите в Netlify

1. Откройте **[https://app.netlify.com/](https://app.netlify.com/)**.
2. Войдите через **GitHub** (Sign up / Log in with GitHub).

---

## Шаг 3. Создайте новый сайт из репозитория

1. Нажмите **Add new site** → **Import an existing project**.
2. Выберите **GitHub**.
3. Разрешите доступ к GitHub, если попросят.
4. В списке репозиториев найдите **nanphoto** и нажмите **Import** (или **Select** рядом с ним).

---

## Шаг 4. Настройки сборки

На экране **Configure build** проверьте:

| Поле | Значение |
|------|----------|
| **Branch to deploy** | `main` |
| **Build command** | `npm run build` (часто подставляется из `netlify.toml`) |
| **Publish directory** | оставьте как предлагает Netlify (для Next.js может быть пусто или `.next`) |

Если Netlify сам определил Next.js — ничего не меняйте. Нажмите **Add environment variables** (или **Environment variables**), переходите к шагу 5.

---

## Шаг 5. Переменные окружения (обязательно)

Нажмите **Add environment variables** / **New variable** / **Add a variable** и добавьте:

1. **Key:** `GEMINI_API_KEY`  
   **Value:** ваш API-ключ Gemini (из [Google AI Studio](https://aistudio.google.com/apikey) или из `.env.local`).  
   **Save.**

2. (По желанию) Защита паролем:  
   **Key:** `NANPHOTO_PASSWORD`  
   **Value:** пароль, который будете вводить при заходе на сайт.  
   **Save.**

3. **Галерея (до 40 картинок):** подключите Neon:
   - В Netlify откройте **Site configuration** → **Integrations** (или **Build & deploy** → **Environment**).
   - Найдите **Neon** в каталоге интеграций и нажмите **Enable** / **Connect**.
   - Создайте базу (или привяжите существующий проект Neon). Netlify добавит переменную **`DATABASE_URL`** автоматически.
   - Либо вручную: создайте проект на [neon.tech](https://neon.tech), скопируйте connection string и добавьте переменную **Key:** `DATABASE_URL`, **Value:** `postgresql://...?sslmode=require`.

После добавления переменных нажмите **Deploy site** (или кнопку деплоя внизу).

---

## Шаг 6. Дождитесь сборки

- Netlify установит зависимости и выполнит `npm run build`.
- Обычно это 2–5 минут.
- При успехе появится зелёный статус **Published** и ссылка вида `https://случайное-имя-123.netlify.app`.

---

## Шаг 7. Откройте сайт

1. Нажмите на ссылку сайта или **Open production deploy**.
2. Если задавали **NANPHOTO_PASSWORD** — откроется форма ввода пароля. Введите пароль и нажмите **Войти**.
3. Должна открыться главная nanphoto: поле описания, кнопка «Нарисовать!», уточнения.

---

## Что проверить, если что-то не работает

- **Ошибка сборки:** откройте **Deploys** → последний деплой → **Deploy log** и посмотрите, на каком шаге упало (часто это отсутствие `GEMINI_API_KEY`).
- **На сайте «Требуется авторизация» или пустая страница:** проверьте, что в Netlify в **Site configuration** → **Environment variables** есть `GEMINI_API_KEY` и при необходимости `NANPHOTO_PASSWORD`, затем сделайте **Trigger deploy** → **Deploy site** заново.
- **Свой домен:** в Netlify: **Domain management** → **Add custom domain** и следуйте подсказкам.

---

## Краткий чеклист

- [ ] Проект в GitHub
- [ ] Netlify: Add new site → Import from GitHub → выбран репозиторий nanphoto
- [ ] Добавлена переменная `GEMINI_API_KEY`
- [ ] (Опционально) Добавлена переменная `NANPHOTO_PASSWORD`
- [ ] Запущен Deploy site
- [ ] Сайт открывается по ссылке Netlify

Готово: проект установлен и запущен на Netlify.
