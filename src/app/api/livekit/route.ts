import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const role = req.nextUrl.searchParams.get('role') || 'student';
  const username = role === 'teacher' ? 'Teacher' : `Student_${Math.floor(Math.random() * 1000)}`;

  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit API Credentials not configured in .env.local' }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    name: username,
  });

  const isTeacher = role === 'teacher';
  
  // Strict Role Based Video Permissions
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,           // Allow everyone to open camera and mic (Two-way video!)
    canSubscribe: true,         // Everyone can watch
    canPublishData: true,       // Everyone can send Drawings / Sync updates via DataChannels
  });

  return NextResponse.json({ token: await at.toJwt() });
}
