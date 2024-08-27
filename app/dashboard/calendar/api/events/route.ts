import { authOptions } from "@/lib/AuthOptions";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { title, description, start, end, allDay } = await req.json();

  const event = await prisma.event.create({
    data: {
      title,
      description,
      start: new Date(start),
      end: new Date(end),
      allDay,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ event });
}
