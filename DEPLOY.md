# Публикация на GitHub и Vercel

## Перед пушем в GitHub

- **Не коммитьте** файлы `.env`, `.env.local` и любые файлы с реальными ключами.
- В репозитории уже есть только `.env.example` с подставными значениями.
- Ключи задавайте в **Vercel → Project → Settings → Environment Variables**.

## Как залить на GitHub

1. Создайте новый репозиторий на [github.com](https://github.com/new) (например, `nanphoto`). Не добавляйте README, .gitignore и лицензию — они уже есть в проекте.

2. В папке проекта выполните:

```bash
cd /home/workshopai/nanphoto
git init
git add .
git commit -m "Initial commit: nanphoto"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/nanphoto.git
git push -u origin main
```

Подставьте вместо `ВАШ_ЛОГИН` свой логин GitHub и при необходимости измените имя репозитория.

3. В Vercel: **Add New Project** → **Import** репозитория → укажите `GEMINI_API_KEY` (и при необходимости `BLOB_READ_WRITE_TOKEN`) в Environment Variables → Deploy.
