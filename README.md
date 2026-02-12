# nanphoto

Милая веб‑страница: поле запроса + оптимизатор уточнений → генерация через API Gemini → результат на странице.

## Локальный запуск

```bash
npm install
cp .env.example .env.local
# В .env.local укажите: GEMINI_API_KEY=ваш_ключ
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Деплой

### Netlify (рекомендуется для этого проекта)

1. Залейте проект на GitHub.
2. В [Netlify](https://app.netlify.com/) нажмите **Add new site** → **Import an existing project** → выберите репозиторий.
3. **Build command:** `npm run build` (подставится из `netlify.toml`).
4. В **Site configuration** → **Environment variables** добавьте:
   - **Key:** `GEMINI_API_KEY`  
   - **Value:** ваш API‑ключ Gemini  
   - **Key:** `DATABASE_URL`  
   - **Value:** строка подключения к Neon (см. ниже)  
5. Нажмите **Deploy site**.

**Галерея (до 40 картинок):** в Netlify откройте **Integrations** → найдите **Neon** и подключите (или создайте БД на [neon.tech](https://neon.tech)). Переменная `DATABASE_URL` подтянется автоматически. Картинки сохраняются в таблице Postgres.

### Vercel

1. Подключите репозиторий к [Vercel](https://vercel.com).
2. В **Environment Variables** задайте `GEMINI_API_KEY` и `DATABASE_URL` (Neon connection string), чтобы работала галерея.

Ключи хранятся только в переменных окружения, в коде их нет.
