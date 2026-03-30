import { NextResponse } from 'next/server';

// Temporary purely in-memory datastore for active board sessions during local dev!
// In production, this will be replaced completely by Supabase/LiveKit.
const globalBoardState: Record<string, any[]> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  
  if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });

  return NextResponse.json({ elements: globalBoardState[roomId] || [] });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  
  if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });

  try {
    const { elements } = await request.json();
    globalBoardState[roomId] = elements;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
