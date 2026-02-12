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
   (значение скрыто и не попадёт в репозиторий.)
5. Нажмите **Deploy site**.

**Галерея на Netlify:** сохранение до 40 картинок на сервере (Vercel Blob) на Netlify не поддерживается. Генерация и просмотр результата работают; блок «Последние картинки» и страница «Галерея» будут пустыми, пока не настроите своё хранилище.

### Vercel

1. Подключите репозиторий к [Vercel](https://vercel.com).
2. В **Environment Variables** задайте `GEMINI_API_KEY`.
3. **Галерея (опционально):** Vercel → **Storage** → **Blob** → создайте store, тогда появится `BLOB_READ_WRITE_TOKEN` и до 40 картинок будут храниться на сервере.

Ключи хранятся только в переменных окружения, в коде их нет.
