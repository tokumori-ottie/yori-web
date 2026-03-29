import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Server configuration error', { status: 500 })
  }

  // サービスロールでauth.usersを削除（ON DELETE CASCADEで関連データも全削除）
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('Delete user error:', error)
    return new Response('Failed to delete account', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
