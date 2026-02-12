# Публикация на GitHub и деплой

## Перед пушем в GitHub

- **Не коммитьте** файлы `.env`, `.env.local` и любые файлы с реальными ключами.
- В репозитории только `.env.example` с заглушками. Ключи задавайте в панели хостинга (Netlify или Vercel).

## Как залить на GitHub

1. Создайте репозиторий на [github.com](https://github.com/new) (например, `nanphoto`). Не добавляйте README, .gitignore и лицензию.

2. В папке проекта:

```bash
cd /home/workshopai/nanphoto
git remote add origin https://github.com/ВАШ_ЛОГИН/nanphoto.git
git push -u origin main
```

## Деплой на Netlify

1. [app.netlify.com](https://app.netlify.com/) → **Add new site** → **Import an existing project** → выберите GitHub и репозиторий.
2. Build command и Node версия подхватятся из `netlify.toml`.
3. **Environment variables** → добавьте `GEMINI_API_KEY` (ваш ключ Gemini).
4. **Deploy site**. Генерация картинок будет работать. Серверная галерея (40 картинок) на Netlify не используется — для неё нужен Vercel Blob (при деплое на Vercel).

## Деплой на Vercel

**Add New Project** → Import репозитория → в **Environment Variables** укажите `GEMINI_API_KEY` и при необходимости `BLOB_READ_WRITE_TOKEN` (после создания Blob Store в Vercel) → Deploy.
