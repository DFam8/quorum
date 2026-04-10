import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { resident } from '../../db/schema'

const BUCKET = 'announcement-images'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser?.email) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const res = await db.query.resident.findFirst({ where: eq(resident.email, supabaseUser.email) })
  if (!res || res.role !== 'board') throw createError({ statusCode: 403, message: 'Board members only' })

  const form = await readMultipartFormData(event)
  const filePart = form?.find(p => p.name === 'file')
  if (!filePart?.data) throw createError({ statusCode: 400, message: 'No file provided' })

  const contentType = filePart.type ?? 'application/octet-stream'
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw createError({ statusCode: 400, message: 'Only JPEG, PNG, WebP, or GIF allowed' })
  }
  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, message: 'Image must be under 5 MB' })
  }

  const ext = contentType.split('/')[1]!.replace('jpeg', 'jpg')
  const path = `${res.communityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const supabase = serverSupabaseServiceRole(event)
  const { error } = await supabase.storage.from(BUCKET).upload(path, filePart.data, {
    contentType,
    upsert: false,
  })
  if (error) throw createError({ statusCode: 500, message: error.message })

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
})
