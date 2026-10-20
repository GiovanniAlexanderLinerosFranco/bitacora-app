import "server-only";
import { after } from "next/server";
import { indexLedgerEntry } from "../../services/indexing.service";

/** Runs indexing after the response is sent so saving an entry stays fast. Failures end up as status 'failed'. */
export function scheduleIndexing(userId: string, entryId: string): void {
  after(async () => {
    try {
      await indexLedgerEntry(userId, entryId);
    } catch (e) {
      console.error("[indexing] failed", entryId, e instanceof Error ? e.message : e);
    }
  });
}
