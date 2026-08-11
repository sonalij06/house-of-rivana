process.env.DATABASE_URL ??=
  "postgresql://rivana:rivana@localhost:5433/rivana?schema=public";
process.env.BETTER_AUTH_SECRET ??= "test-secret-at-least-16-chars";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
