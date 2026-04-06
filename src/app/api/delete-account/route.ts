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
    console.error('Delete account: missing env vars')
    return new Response('Server configuration error', { status: 500 })
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ユーザーデータを明示的に削除（ON DELETE CASCADE のバックアップ）
  // profiles は主キーが id（user_id ではない）
  const userIdTables = [
    'weekly_summaries',
    'monthly_summaries',
    'messages',
    'daily_logs',
    'chat_sessions',
    'children',
  ]
  for (const table of userIdTables) {
    const { error } = await adminClient.from(table).delete().eq('user_id', user.id)
    if (error) console.error(`Delete ${table} error:`, error)
  }
  const { error: profileError } = await adminClient.from('profiles').delete().eq('id', user.id)
  if (profileError) console.error('Delete profiles error:', profileError)

  // Supabase Auth からユーザーを削除（REST API 直接呼び出し）
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  })

  if (!deleteRes.ok) {
    const body = await deleteRes.text().catch(() => '')
    console.error('Delete auth user error:', deleteRes.status, body)
    return new Response('Failed to delete account', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
