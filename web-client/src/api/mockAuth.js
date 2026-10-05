import client from './client';

export const USE_MOCK_AUTH = false;

// Pre-computed SVG QR code as base64 data URL
const MOCK_QR_CODE = 'data:image/svg+xml;base64,' + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="white"/>
  <rect x="20" y="20" width="50" height="50" fill="black"/>
  <rect x="30" y="30" width="30" height="30" fill="white"/>
  <rect x="40" y="40" width="10" height="10" fill="black"/>
  <rect x="130" y="20" width="50" height="50" fill="black"/>
  <rect x="140" y="30" width="30" height="30" fill="white"/>
  <rect x="150" y="40" width="10" height="10" fill="black"/>
  <rect x="20" y="130" width="50" height="50" fill="black"/>
  <rect x="30" y="140" width="30" height="30" fill="white"/>
  <rect x="40" y="150" width="10" height="10" fill="black"/>
  <rect x="90" y="20" width="20" height="20" fill="black"/>
  <rect x="90" y="60" width="20" height="30" fill="black"/>
  <rect x="20" y="90" width="30" height="20" fill="black"/>
  <rect x="70" y="90" width="20" height="20" fill="black"/>
  <rect x="110" y="90" width="30" height="20" fill="black"/>
  <rect x="160" y="90" width="20" height="30" fill="black"/>
  <rect x="90" y="130" width="30" height="20" fill="black"/>
  <rect x="130" y="130" width="20" height="40" fill="black"/>
  <rect x="160" y="140" width="20" height="20" fill="black"/>
  <rect x="90" y="160" width="20" height="20" fill="black"/>
</svg>`.trim());

// Helper for simulated network delay in mock mode
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Register new user
 * Shape: { message, otpauth_url, qr_code, totp_secret }
 */
export async function register(email, password) {
  if (USE_MOCK_AUTH) {
    await delay(300);
    const mockSecret = 'JBSWY3DPEHPK3PXP';
    const otpauthUrl = `otpauth://totp/ToxicTwitter:${encodeURIComponent(email)}?secret=${mockSecret}&issuer=ToxicTwitterApp`;
    return {
      message: 'Registration successful. Please configure 2FA.',
      otpauth_url: otpauthUrl,
      qr_code: MOCK_QR_CODE,
      totp_secret: mockSecret,
    };
  }

  const res = await client.post('/api/auth/register', { email, password });
  return res.data;
}

/**
 * User login
 * Shape: { message, tempToken }
 */
export async function login(email, password) {
  if (USE_MOCK_AUTH) {
    await delay(300);
    return {
      message: 'Credentials verified. 2FA code verification required.',
      tempToken: `mock_temp_token_${btoa(email)}_${Date.now()}`,
    };
  }

  const res = await client.post('/api/auth/login', { email, password });
  return res.data;
}

/**
 * Admin login
 * Shape: { message, tempToken }
 */
export async function adminLogin(email, password) {
  if (USE_MOCK_AUTH) {
    await delay(300);
    return {
      message: 'Admin credentials verified. 2FA code verification required.',
      tempToken: `mock_admin_temp_token_${btoa(email)}_${Date.now()}`,
    };
  }

  const res = await client.post('/api/admin/login', { email, password });
  return res.data;
}

/**
 * Verify 2FA TOTP code
 * Shape: { message, token, user: { id, email, role } }
 * NOTE: The field is "token", NOT "jwt".
 */
export async function verify2fa(tempToken, code) {
  if (USE_MOCK_AUTH) {
    await delay(300);

    // Basic format validation
    if (!code || code.length !== 6) {
      const err = new Error('Invalid 2FA code. Please enter a 6-digit code.');
      err.response = { data: { error: 'Invalid 2FA code. Please try again.' }, status: 401 };
      throw err;
    }

    const isAdmin = tempToken && tempToken.includes('admin');
    let email = 'user@example.com';
    try {
      const parts = tempToken.split('_');
      if (parts[3]) {
        email = atob(parts[3]);
      } else if (parts[2]) {
        email = atob(parts[2]);
      }
    } catch {
      // Fallback email
    }

    return {
      message: 'Authentication successful.',
      token: `mock_jwt_token_${isAdmin ? 'admin' : 'user'}_${Date.now()}`,
      user: {
        id: `mock-user-${Date.now().toString().slice(-4)}`,
        email: email,
        role: isAdmin ? 'ADMIN' : 'USER',
      },
    };
  }

  const res = await client.post('/api/auth/2fa/verify', { tempToken, code });
  return res.data;
}

export default {
  USE_MOCK_AUTH,
  register,
  login,
  adminLogin,
  verify2fa,
};
