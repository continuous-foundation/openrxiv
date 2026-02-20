import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// For migrations: use DIRECT_URL when available (Supabase connection pooler),
// otherwise DATABASE_URL (local/dev where they're the same)
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/scripts/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});
