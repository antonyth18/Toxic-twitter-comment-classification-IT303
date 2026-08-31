const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const prisma = require('../prisma');
require('dotenv').config();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be configured in your .env file.');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `ToxicTwitterAdmin:${email}`,
      issuer: 'ToxicTwitterApp'
    });

    let adminUser;

    if (existingUser) {
      console.log(`User ${email} already exists. Updating credentials and setting role to ADMIN...`);
      adminUser = await prisma.user.update({
        where: { email },
        data: {
          password_hash,
          role: 'ADMIN',
          status: 'active',
          totp_secret: secret.base32
        }
      });
    } else {
      console.log(`Creating new administrator account for ${email}...`);
      adminUser = await prisma.user.create({
        data: {
          email,
          password_hash,
          role: 'ADMIN',
          status: 'active',
          totp_secret: secret.base32
        }
      });
    }

    console.log('\n==================================================');
    console.log('  ADMINISTRATOR ACCOUNT SEEDED SUCCESSFULLY');
    console.log('==================================================');
    console.log(`Email:       ${adminUser.email}`);
    console.log(`Role:        ${adminUser.role}`);
    console.log(`Status:      ${adminUser.status}`);
    console.log(`TOTP Secret (Base32): ${secret.base32}`);
    console.log(`TOTP Auth URI:        ${secret.otpauth_url}`);
    console.log('==================================================');
    console.log('Add the TOTP Secret to your authenticator app to log in.');
    console.log('==================================================\n');

  } catch (error) {
    console.error('Error seeding admin account:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
