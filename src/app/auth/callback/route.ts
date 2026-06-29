import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Vincular auth_user_id con el participante por email
      await supabase
        .from("participants")
        .update({ auth_user_id: user.id, email: user.email })
        .eq("email", user.email!)
        .is("auth_user_id", null);

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
