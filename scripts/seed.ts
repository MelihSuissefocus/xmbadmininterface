// scripts/seed.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from '../src/db/schema';
import { hash } from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const password = await hash('admin123', 10); // Passwort: admin123

  try {
    await db.insert(users).values({
      email: 'admin@xmb-group.ch',
      password: password,
      role: 'admin',
    });
    console.log('✅ Admin User created');
  } catch (error) {
    console.error('❌ Error seeding:', error);
  }
};

run();