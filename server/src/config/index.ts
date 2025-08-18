import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HTTP_PORT: z.string().default('8080').transform(Number),
  DATABASE_URL: z
    .string()
    .default(`postgresql://${process.env['USER'] || 'postgres'}@localhost:5432/messaging_db`),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  http: {
    port: env.HTTP_PORT,
  },
  grpc: {
    port: 50051,
  },
  database: {
    url: env.DATABASE_URL,
  },
} as const;
