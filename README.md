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

## Деплой на Vercel

1. Залейте проект в GitHub и подключите репозиторий к Vercel.
2. В настройках проекта Vercel → **Environment Variables** добавьте:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** ваш API‑ключ Gemini
3. **Галерея (опционально):** в Vercel откройте **Storage** → **Create Database** → **Blob**. Создайте Blob Store — переменная `BLOB_READ_WRITE_TOKEN` появится сама. Тогда до 40 последних картинок будут храниться на сервере и отображаться на странице «Галерея».
4. Деплой: Vercel соберёт проект по `npm run build` и запустит его.

Ключи хранятся только в переменных окружения.
