"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddCeremony } from "./add-ceremony";
import { DeleteCeremony } from "./delete-ceremony";
import type { EventDTO } from "@/modules/events/validation";
import { ceremonyTiming, compareCeremonies } from "@/modules/events/validation";
import styles from "./ceremonies.module.css";
export function CeremonyList({
  events: initial,
  initialDeleted = false,
}: {
  events: EventDTO[];
  initialDeleted?: boolean;
}) {
  const router = useRouter();
  const [added, setAdded] = useState<EventDTO[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [message, setMessage] = useState(
    initialDeleted
      ? "Ceremony deleted. Other ceremonies remain unchanged."
      : "",
  );
  const merged = new Map(initial.map((event) => [event.id, event]));
  for (const event of added)
    if (!merged.has(event.id)) merged.set(event.id, event);
  const events = [...merged.values()]
    .filter((event) => !removed.includes(event.id))
    .sort(compareCeremonies);
  const [filter, setFilter] = useState("all");
  const published = events.filter(
    (event) => event.status === "published",
  ).length;
  const visible = events.filter(
    (event) => filter === "all" || event.status === filter,
  );
  return (
    <>
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      <div className={styles.listToolbar}>
        <div
          className={styles.filters}
          role="group"
          aria-label="Filter ceremonies"
        >
          {[
            ["all", "All ceremonies", events.length],
            ["published", "Published", published],
            ["draft", "Drafts", events.length - published],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(String(value))}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        <div className={styles.listControls}>
          <p>
            {published} / {events.length} published
          </p>
          <AddCeremony
            onCreated={(event) => {
              setAdded((previous) => [
                ...previous.filter((saved) => saved.id !== event.id),
                event,
              ]);
              setMessage("Ceremony saved as a draft.");
            }}
          />
        </div>
      </div>
      {visible.length === 0 ? (
        <div className={styles.empty}>
          <h2>
            {events.length
              ? "No ceremonies match this filter."
              : "No ceremonies are currently listed."}
          </h2>
          <p>
            {events.length
              ? "Choose another filter to see your saved ceremonies."
              : "Add a custom celebration to begin. Deleted presets are not recreated by wedding setup."}
          </p>
          <Link href="/workspace">Back to wedding overview</Link>
        </div>
      ) : (
        <ol className={styles.list}>
          {visible.map((event) => {
            const ready = !!(event.startsAt && event.venue);
            return (
              <li key={event.id}>
                <div className={styles.number}>
                  {String(
                    events.findIndex((saved) => saved.id === event.id) + 1,
                  ).padStart(2, "0")}
                </div>
                <div className={styles.cardContent}>
                  <p className={styles.kind}>
                    {event.presetKey ? "Preset" : "Custom"}
                  </p>
                  <div className={styles.titleRow}>
                    <h2>{event.name}</h2>
                    <span
                      className={
                        event.status === "published"
                          ? styles.published
                          : styles.draft
                      }
                    >
                      {event.status}
                    </span>
                    {event.status === "draft" && (
                      <span className={styles.readiness}>
                        {ready ? "Ready to publish" : "Incomplete details"}
                      </span>
                    )}
                  </div>
                  <div className={styles.facts}>
                    <p>{ceremonyTiming(event.startsAt)}</p>
                    <p>{event.venue || "Venue: Not configured"}</p>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <Link
                    className={styles.edit}
                    href={"/ceremonies/" + event.id}
                  >
                    Edit ceremony{" "}
                    <span className={styles.srOnly}>{event.name}</span> →
                  </Link>
                  <DeleteCeremony
                    event={event}
                    onDeleted={() => {
                      setRemoved((previous) => [...previous, event.id]);
                      setMessage(
                        "Ceremony removed from the list. Other ceremonies remain unchanged.",
                      );
                      router.refresh();
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
