import Link from "next/link";
import { currentReviewer } from "@/auth/access";
import { BandBadge } from "@/components/team/band-badge";
import { SignInAsReviewer } from "@/components/team/sign-in-as-reviewer";
import { getAppDatabase } from "@/db/app-db";
import { listReviewQueue } from "@/services/review";

export const dynamic = "force-dynamic";

const ACTION_LABEL = { approve: "Approved", request_document: "Document requested", reject: "Rejected" } as const;

// The review queue: every submitted application, newest first.
export default async function TeamQueuePage() {
  const reviewer = await currentReviewer();
  if (!reviewer.ok) return <SignInAsReviewer />;
  const queue = await listReviewQueue(await getAppDatabase());

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Applications to review</h1>
      {queue.length === 0 ? (
        <p className="text-muted-foreground">No submitted applications yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {queue.map((item) => (
            <li key={item.id}>
              <Link
                href={`/team/applications/${item.id}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{item.companyName ?? `Application ${item.id}`}</span>
                  <span className="text-sm text-muted-foreground">
                    Submitted {item.submittedAt?.slice(0, 10)}
                    {item.lastAction ? ` · ${ACTION_LABEL[item.lastAction]}` : " · Not reviewed"}
                  </span>
                </span>
                {item.score ? (
                  <span className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{item.score.score}</span>
                    <BandBadge band={item.score.band} />
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Assessment missing</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
