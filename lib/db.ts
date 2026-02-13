import { neon } from "@neondatabase/serverless";

const MAX_ITEMS = 100;

export type GalleryRow = {
  id: string;
  image_base64: string;
  mime_type: string;
  text: string | null;
  created_at: Date;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");
  return neon(url);
}

export async function initGalleryTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      image_base64 TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getGalleryItems(): Promise<{ id: string; mime_type: string; text: string | null }[]> {
  const sql = getSql();
  await initGalleryTable();
  const rows = await sql`
    SELECT id, mime_type, text
    FROM gallery
    ORDER BY created_at DESC
    LIMIT ${MAX_ITEMS}
  `;
  return rows as { id: string; mime_type: string; text: string | null }[];
}

export async function getGalleryImage(id: string): Promise<{ image_base64: string; mime_type: string } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT image_base64, mime_type
    FROM gallery
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as { image_base64: string; mime_type: string } | undefined;
  return row ?? null;
}

export async function addGalleryItem(
  id: string,
  imageBase64: string,
  mimeType: string,
  text: string | null
): Promise<void> {
  const sql = getSql();
  await initGalleryTable();
  await sql`
    INSERT INTO gallery (id, image_base64, mime_type, text)
    VALUES (${id}, ${imageBase64}, ${mimeType}, ${text})
  `;
  const all = await sql`SELECT id FROM gallery ORDER BY created_at ASC`;
  if (all.length > MAX_ITEMS) {
    const toDelete = all.slice(0, all.length - MAX_ITEMS);
    for (const row of toDelete) {
      await sql`DELETE FROM gallery WHERE id = ${(row as { id: string }).id}`;
    }
  }
}
