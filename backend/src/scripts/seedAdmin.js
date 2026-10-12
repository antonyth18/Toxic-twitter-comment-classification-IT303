const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
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

    // Determine TOTP secret:
    // 1. Env variable ADMIN_TOTP_SECRET if provided
    // 2. Existing user's totp_secret if already set (preserving authenticator sync)
    // 3. Newly generated secret
    let base32Secret = process.env.ADMIN_TOTP_SECRET;

    if (!base32Secret && existingUser && existingUser.totp_secret && process.env.RESET_2FA !== 'true') {
      base32Secret = existingUser.totp_secret;
    }

    if (!base32Secret) {
      const generated = speakeasy.generateSecret({
        name: `ToxicTwitterAdmin:${email}`,
        issuer: 'ToxicTwitterApp'
      });
      base32Secret = generated.base32;
    }

    const otpauth_url = `otpauth://totp/ToxicTwitterApp:${encodeURIComponent(email)}?secret=${base32Secret}&issuer=ToxicTwitterApp`;

    let adminUser;

    if (existingUser) {
      console.log(`User ${email} already exists. Updating credentials...`);
      adminUser = await prisma.user.update({
        where: { email },
        data: {
          password_hash,
          role: 'ADMIN',
          status: 'active',
          totp_secret: base32Secret
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
          totp_secret: base32Secret
        }
      });
    }

    const currentToken = speakeasy.totp({
      secret: base32Secret,
      encoding: 'base32'
    });

    console.log('\n==================================================');
    console.log('  ADMINISTRATOR ACCOUNT READY');
    console.log('==================================================');
    console.log(`Email:               ${adminUser.email}`);
    console.log(`Role:                ${adminUser.role}`);
    console.log(`Status:              ${adminUser.status}`);
    console.log(`TOTP Secret (Base32): ${base32Secret}`);
    console.log(`Current 6-Digit Code: ${currentToken} (valid for ~30s)`);
    console.log('==================================================');
    console.log('Scan the QR code below with Google Authenticator / Authy:\n');

    try {
      const qrAscii = await qrcode.toString(otpauth_url, { type: 'terminal', small: true });
      console.log(qrAscii);
    } catch (e) {
      // Fallback if terminal qrcode fails
    }

    console.log('==================================================\n');

  } catch (error) {
    console.error('Error seeding admin account:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
