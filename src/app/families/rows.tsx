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
          <th scope="col">Contact email</th>
          <th scope="col">Invited members</th>
          <th scope="col">Ceremony attendance</th>
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
              <span className={styles.mobileLabel}>Contact email</span>
              {f.email || "No email address saved"}
            </td>
            <td>
              <span className={styles.count}>{f.invitedCount} members</span>
            </td>
            <td>
              <span className={styles.mobileLabel}>Ceremony attendance</span>
              {f.assignedEvents.some((e) => e.status === "published")
                ? f.assignedEvents
                    .filter((e) => e.status === "published")
                    .map((e) => (
                      <p key={e.id}>
                        <Link href={"/attendance?eventId=" + e.id}>
                          {e.name}
                        </Link>
                        :{" "}
                        {e.response === "attending"
                          ? `Attending · ${e.attendingCount} members`
                          : e.response === "notAttending"
                            ? "Not attending"
                            : "Pending"}
                      </p>
                    ))
                : "No published ceremonies assigned"}
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
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
