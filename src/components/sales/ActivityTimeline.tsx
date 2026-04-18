"use client";

import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Users, StickyNote, Package, MessageCircle, MailOpen } from "lucide-react";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  email_sent: Mail,
  email_received: MailOpen,
  call: Phone,
  meeting: Users,
  note: StickyNote,
  sample_sent: Package,
  linkedin_message: MessageCircle,
};

const OUTCOME_COLORS: Record<string, string> = {
  positive: "text-green-600",
  neutral: "text-muted-foreground",
  negative: "text-red-600",
  no_response: "text-amber-600",
};

interface Activity {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  created_at: string;
  contact?: { name: string; title: string | null } | null;
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activities recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((a) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
        return (
          <div key={a.id} className="flex gap-3 text-sm">
            <div className="mt-0.5 shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium capitalize">{a.type.replace(/_/g, " ")}</span>
                {a.outcome && (
                  <span className={`text-xs ${OUTCOME_COLORS[a.outcome] ?? ""}`}>
                    ({a.outcome.replace(/_/g, " ")})
                  </span>
                )}
                {a.contact && (
                  <Badge variant="outline" className="text-xs">
                    {a.contact.name}
                  </Badge>
                )}
              </div>
              {a.subject && <p className="text-muted-foreground">{a.subject}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(a.created_at).toLocaleDateString()}
                {a.follow_up_date && (
                  <span className="ml-2">Follow-up: {a.follow_up_date}</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
