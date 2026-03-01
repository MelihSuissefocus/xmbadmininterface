import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from '../src/db/schema';
import { hash } from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const newUsers = [
  { email: 'bze@xmb-group.ch', password: 'K7#mP9xQ2v', role: 'admin' as const },
  { email: 'moe@xmb-group.ch', password: 'R3@nL5wJ8t', role: 'admin' as const },
  { email: 'xho@xmb-group.ch', password: 'V2$bH6yM4k', role: 'admin' as const },
];

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  for (const user of newUsers) {
    const hashedPassword = await hash(user.password, 10);
    try {
      await db.insert(users).values({
        email: user.email,
        password: hashedPassword,
        role: user.role,
      });
      console.log(`✅ User created: ${user.email} | Password: ${user.password}`);
    } catch (error) {
      console.error(`❌ Error creating ${user.email}:`, error);
    }
  }
};

run();
