export async function register() {
  // Only run migrations in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrate } = await import('./lib/db')
    await migrate()
  }
}
