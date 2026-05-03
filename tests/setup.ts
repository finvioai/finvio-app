import { vi } from 'vitest'

// Stub Next.js server-only modules
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

// Set env vars required by supabase clients
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ENCRYPTION_KEY = '0'.repeat(64)  // 32-byte hex
process.env.CRON_SECRET = 'test-cron-secret'
