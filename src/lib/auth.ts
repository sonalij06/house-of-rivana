import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { env, features, isProd } from "@/lib/env";
import { sendEmail } from "@/lib/notifications";
import {
  passwordResetEmail,
  verifyEmailTemplate,
} from "@/lib/notifications/templates";

export const auth = betterAuth({
  appName: "House of Rivana",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,
  // Accept both localhost and 127.0.0.1 during local development.
  trustedOrigins: Array.from(
    new Set(
      [
        env.NEXT_PUBLIC_APP_URL,
        env.BETTER_AUTH_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ].filter(Boolean) as string[],
    ),
  ),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        templateName: "password-reset",
        template: passwordResetEmail({ name: user.name, resetUrl: url }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        templateName: "verify-email",
        template: verifyEmailTemplate({ name: user.name, verifyUrl: url }),
      });
    },
  },

  socialProviders: features.googleAuth
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  user: {
    additionalFields: {
      // `input: false` keeps role out of the signup payload — privilege is only
      // ever granted server-side from /admin/users or the seed.
      role: { type: "string", defaultValue: "CUSTOMER", input: false },
      phone: { type: "string", required: false, input: true },
      marketingOptIn: { type: "boolean", defaultValue: false, required: false },
      banned: { type: "boolean", defaultValue: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    useSecureCookies: isProd,
    cookiePrefix: "rivana",
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": { window: 60, max: 6 },
      "/sign-up/email": { window: 300, max: 5 },
      "/forget-password": { window: 300, max: 4 },
    },
  },

  plugins: [nextCookies()],
});

export type Auth = typeof auth;
