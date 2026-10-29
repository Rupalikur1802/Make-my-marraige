"use client";
import Link from "next/link";
import type { FamilyList } from "@/modules/families/validation";
import { DeleteFamily } from "./delete-family";
import styles from "./families.module.css";
export function FamilyRows({ families }: { families: FamilyList["families"] }) {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>
        Saved family records and ceremony assignments
      </caption>
      <thead>
        <tr>
          <th scope="col">Family name</th>
          <th scope="col">Invitation email</th>
          <th scope="col">Invited members</th>
          <th scope="col">Guest response</th>
          <th scope="col">Assigned ceremonies</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {families.map((f) => (
          <tr key={f.id}>
            <td>
              <strong>{f.name}</strong>
            </td>
            <td>
              <span className={styles.mobileLabel}>Invitation email</span>
              {f.email || "No email address saved"}
            </td>
            <td>
              <span className={styles.count}>{f.invitedCount} members</span>
            </td>
            <td>
              <span className={styles.mobileLabel}>Guest response</span>
              {f.invitationAcceptedAt ? (
                <>
                  <strong>Accepted</strong>
                  <br />
                  <time dateTime={f.invitationAcceptedAt}>
                    {new Date(f.invitationAcceptedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </time>
                </>
              ) : (
                "Awaiting acceptance"
              )}
            </td>
            <td>
              <span className={styles.mobileLabel}>Assigned ceremonies</span>
              <div className={styles.chips}>
                {f.assignedEvents.length ? (
                  f.assignedEvents.map((e) => (
                    <span className={styles.chip} key={e.id}>
                      {e.name} · {e.status}
                    </span>
                  ))
                ) : (
                  <span className={styles.muted}>No ceremonies assigned</span>
                )}
              </div>
            </td>
            <td>
              <div className={styles.rowActions}>
                <Link href={"/families/" + f.id} aria-label={"Edit " + f.name}>
                  Edit family
                </Link>
                <DeleteFamily family={f} />
                <Link href={"/families/" + f.id + "/invitation"}>
                  Manage invitation
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
