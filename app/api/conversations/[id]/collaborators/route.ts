import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { addCollaborator, listCollaborators, removeCollaborator } from '@/lib/conversations/collaborators'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const collaborators = await listCollaborators(conversationId)
  return NextResponse.json(collaborators)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { userId?: string }
  if (!body.userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const service = createServiceClient()
  const { data: conv } = await service
    .from('conversations')
    .select('subject')
    .eq('id', conversationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const result = await addCollaborator({
    conversationId,
    userId: body.userId,
    addedBy: user.id,
    subject: conv.subject,
  })

  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Failed to add collaborator' }, { status: 500 })

  const collaborators = await listCollaborators(conversationId)
  return NextResponse.json(collaborators)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { userId?: string }
  if (!body.userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const service = createServiceClient()
  await removeCollaborator(conversationId, body.userId)
  const collaborators = await listCollaborators(conversationId)
  return NextResponse.json(collaborators)
}
