/**
 * Standalone Administrator Bootstrap Script
 * Project: ayyapanthangal-marathon-2026-BE
 *
 * Secure one-time initialization script to bootstrap the initial admin account
 * into the PostgreSQL database.
 *
 * Requirements satisfied:
 * 1. Standalone execution using PrismaClient and bcrypt.
 * 2. Reads credentials strictly from environment variables: ADMIN_EMAIL, ADMIN_PASSWORD.
 * 3. Hashes password using bcrypt with 10 salt rounds (matching AuthService).
 * 4. Checks whether admin email already exists before inserting.
 * 5. Never overwrites or resets an existing admin account.
 * 6. Exits safely with informative output if email exists.
 * 7. Never exposes or logs the password or hashed secret.
 * 8. Validates environment variables before initiating database connection.
 * 9. Explicitly closes Prisma and pg.Pool connections in finally block.
 */

import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const BCRYPT_SALT_ROUNDS = 10;

async function bootstrapAdmin() {
  console.log('=====================================================');
  console.log('   Ayyappanthangal Marathon — Admin Account Bootstrap');
  console.log('=====================================================\n');

  // 1. Validate required environment variables before touching the database
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Configuration Error: DATABASE_URL environment variable is missing.');
    console.error('   Please ensure .env file is present or DATABASE_URL is defined.');
    process.exit(1);
  }

  if (!email) {
    console.error('❌ Validation Error: ADMIN_EMAIL environment variable is missing.');
    console.error('   Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret npm run admin:bootstrap');
    process.exit(1);
  }

  // Basic RFC 5322 email regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`❌ Validation Error: "${email}" is not a valid email address format.`);
    process.exit(1);
  }

  if (!password) {
    console.error('❌ Validation Error: ADMIN_PASSWORD environment variable is missing.');
    console.error('   Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret npm run admin:bootstrap');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Validation Error: ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  console.log(`ℹ️ Validating bootstrap configuration for: ${email}`);

  // 2. Initialize database connection pool and Prisma adapter
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Connect to database
    await prisma.$connect();

    // 3. Check if an admin account with this email already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log(`⚠️ An administrator account with email "${email}" already exists (ID: ${existingAdmin.id}).`);
      console.log('⚠️ Operation aborted: Existing administrator account was not overwritten.');
      return;
    }

    // 4. Hash the password with bcrypt (10 rounds, matching AuthService)
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 5. Create the administrator account
    const newAdmin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    console.log('✅ Administrator account created successfully!');
    console.log(`   - Email: ${newAdmin.email}`);
    console.log(`   - Admin ID: ${newAdmin.id}`);
    console.log(`   - Created At: ${newAdmin.createdAt.toISOString()}`);
    console.log('\n🔒 Security confirmation: Password was securely hashed with 10 salt rounds and not logged.');
  } catch (error: any) {
    console.error('❌ Database error during admin bootstrap:', error?.message || error);
    process.exit(1);
  } finally {
    // 6. Explicitly close all connections
    await prisma.$disconnect();
    await pool.end();
  }
}

// Execute bootstrap
bootstrapAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Unexpected fatal error during bootstrap:', err?.message || err);
    process.exit(1);
  });
