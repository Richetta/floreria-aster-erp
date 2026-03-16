import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL as string,

  // JWT
  jwtSecret: process.env.JWT_SECRET as string,

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Business
  defaultBusinessId: process.env.DEFAULT_BUSINESS_ID || '00000000-0000-0000-0000-000000000001',

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',

  // Supabase (for future features)
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Validation
  validate() {
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long for security');
    }
    if (this.nodeEnv === 'production' && this.jwtSecret.includes('change-this')) {
      throw new Error('JWT_SECRET must be changed in production');
    }

    // Google OAuth validation (optional for development)
    if (this.nodeEnv === 'production') {
      if (!this.googleClientId) {
        throw new Error('GOOGLE_CLIENT_ID environment variable is required in production');
      }
      if (!this.googleClientSecret) {
        throw new Error('GOOGLE_CLIENT_SECRET environment variable is required in production');
      }
    }
  }
};

// Validate on import
config.validate();
