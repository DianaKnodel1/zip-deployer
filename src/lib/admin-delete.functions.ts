import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeleteSchema = z.object({
  user_id: z.string().uuid(),
  confirm: z.literal("MITARBEITER LÖSCHEN"),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

export const deleteEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    if (data.user_id === context.userId) {
      throw new Error("Du kannst dich nicht selbst löschen");
    }

    const uid = data.user_id;
    const sb = supabaseAdmin as any;

    // Schutz: keine Admins/Teamleiter über diesen Weg hart löschen
    const { data: adminCheck } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if ((adminCheck ?? []).some((r: any) => r.role === "admin")) {
      throw new Error("Admin-Accounts können nicht über diese Funktion gelöscht werden.");
    }

    // Abhängige Daten aus public-Tabellen entfernen.
    // Jede Tabelle mit FK auf auth.users muss hier oder via ON DELETE CASCADE abgedeckt sein,
    // sonst schlägt supabaseAdmin.auth.admin.deleteUser() fehl.
    const tablesUserId = [
      "chat_conversations",
      "notifications",
      "kyc_verifications",
      "bookings",
      "task_assignments",
      "task_progress",
      "task_submissions",
      "submission_answers",
      "step_feedback",
      "user_transactions",
      "contracts",
      "documents",
      "uploads",
      "task_sms_messages",
      "sms_assignments",
      "email_send_log",
      "email_send_state",
      "email_unsubscribe_tokens",
      "suppressed_emails",
      "user_roles",
    ];

    for (const t of tablesUserId) {
      const { error: delErr } = await sb.from(t).delete().eq("user_id", uid);
      // 42P01 = relation does not exist, 42703 = column does not exist → tolerieren
      if (delErr && !["42P01", "42703"].includes(delErr.code)) {
        throw new Error(`Löschen aus ${t} fehlgeschlagen: ${delErr.message}`);
      }
    }

    // Tabellen mit anderem User-Spaltennamen
    const cleanups: Array<{ table: string; col: string }> = [
      { table: "admin_notes", col: "profile_user_id" },
      { table: "admin_notes", col: "created_by" },
      { table: "invitation_tokens", col: "created_by" },
      { table: "task_templates", col: "created_by" },
      { table: "time_slots", col: "created_by" },
    ];
    for (const { table, col } of cleanups) {
      const { error: delErr } = await sb.from(table).delete().eq(col, uid);
      if (delErr && !["42P01", "42703"].includes(delErr.code)) {
        throw new Error(`Löschen aus ${table}.${col} fehlgeschlagen: ${delErr.message}`);
      }
    }

    // Profile mit team_leader_id = uid entkoppeln (sonst FK-Verletzung)
    {
      const { error: tlErr } = await sb
        .from("profiles")
        .update({ team_leader_id: null })
        .eq("team_leader_id", uid);
      if (tlErr && !["42P01", "42703"].includes(tlErr.code)) {
        throw new Error(`team_leader_id entkoppeln fehlgeschlagen: ${tlErr.message}`);
      }
    }

    {
      const { error: cmErr } = await sb
        .from("chat_messages")
        .delete()
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
      if (cmErr && !["42P01", "42703"].includes(cmErr.code)) {
        throw new Error(`chat_messages löschen fehlgeschlagen: ${cmErr.message}`);
      }
    }

    {
      const { error: alErr } = await sb
        .from("activity_log")
        .delete()
        .or(`actor_id.eq.${uid},entity_id.eq.${uid}`);
      if (alErr && !["42P01", "42703"].includes(alErr.code)) {
        throw new Error(`activity_log löschen fehlgeschlagen: ${alErr.message}`);
      }
    }

    {
      const { error: pErr } = await sb.from("profiles").delete().eq("user_id", uid);
      if (pErr && !["42P01", "42703"].includes(pErr.code)) {
        throw new Error(`profiles löschen fehlgeschlagen: ${pErr.message}`);
      }
    }

    // Auth-User löschen
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(`Auth-Löschung fehlgeschlagen: ${authErr.message}`);

    try {
      await sb.from("activity_log").insert({
        action: "mitarbeiter_geloescht",
        entity_type: "profile",
        entity_id: uid,
        actor_id: context.userId,
        comment: "Mitarbeiter hart gelöscht (inkl. Auth-Account)",
      });
    } catch {}

    return { ok: true };
  });
