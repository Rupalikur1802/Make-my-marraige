"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export function LoginExperience({ created }: { created: boolean }) {
  const [names, setNames] = useState(["", ""]);
  const [preview, setPreview] = useState(false);
  const couple = names
    .map((name, i) => name.trim() || (i === 0 ? "Partner 1" : "Partner 2"))
    .join(" & ");
  return (
    <main className={styles.canvas} id="login-content">
      <div className={styles.editorial}>
        <div
          className={styles.badges}
          aria-label="Illustrative wedding preview"
        >
          <span>♡ {couple}</span>
          <span>Wedding inspiration</span>
          <span>Invitation preview</span>
        </div>
        <div className={styles.imageMat}>
          <div className={styles.heroImage}>
            <Image
              src="/images/couple-login.jpg"
              alt="Hands joined during an intimate Indian wedding ceremony"
              width={1200}
              height={825}
              priority
              sizes="(max-width: 800px) 100vw, 55vw"
            />
            <span className={styles.topBadge}>
              ✧ Sacred moments · Wedding inspiration
            </span>
            <div className={styles.imageCaption}>
              <span>Archival union</span>
              <span>{couple}</span>
            </div>
          </div>
        </div>
        <div className={styles.gallery}>
          <figure>
            <div>
              <Image
                src="/images/login-mandap.jpg"
                alt="An ivory and gold mandap framed by floral arrangements"
                width={1200}
                height={896}
                sizes="(max-width: 800px) 45vw, 27vw"
              />
              <span>Mandap sanctuary</span>
            </div>
            <figcaption>
              Ceremony &amp; Floral Sanctuary <small>Curated</small>
            </figcaption>
          </figure>
          <figure>
            <div>
              <Image
                src="/images/login-reception.jpg"
                alt="Candlelit reception tables with ivory floral arrangements"
                width={1200}
                height={896}
                sizes="(max-width: 800px) 45vw, 27vw"
              />
              <span>Evening gala</span>
            </div>
            <figcaption>
              Reception Tablescape &amp; Decor <small>Bespoke</small>
            </figcaption>
          </figure>
        </div>
        <div className={styles.narrative}>
          <p className="eyebrow">Composed unions</p>
          <h1>
            Beautiful celebrations.
            <br />
            <em>Thoughtfully planned.</em>
          </h1>
          <p>
            Your ceremonies, families, tasks, and spending—all preserved and
            sequenced in one singular, deliberate space.
          </p>
        </div>
      </div>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.cardToolbar}>
          <span>Bespoke Atelier</span>
          <div role="group" aria-label="Login display">
            <button
              type="button"
              aria-pressed={!preview}
              onClick={() => setPreview(false)}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={preview}
              onClick={() => setPreview(true)}
            >
              Live preview
            </button>
          </div>
        </div>
        {preview ? (
          <div className={styles.preview}>
            <p className="eyebrow">Illustrative preview</p>
            <h2 id="login-title">{couple}</h2>
            <p>
              Your names personalize this preview only. Sign in to access your
              saved wedding workspace.
            </p>
            <button
              className={styles.submit}
              type="button"
              onClick={() => setPreview(false)}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">Couple workspace · Secure access</p>
            <h2 id="login-title">Welcome back.</h2>
            <p className={styles.intro}>
              Enter your credentials to access your shared suite.
            </p>
          </>
        )}
        <div hidden={preview}>
          <fieldset className={styles.names}>
            <legend>
              Couple names <span>(preview only)</span>
            </legend>
            <div>
              {names.map((name, i) => (
                <label key={i}>
                  <span className={styles.srOnly}>
                    Partner {i + 1} name for preview
                  </span>
                  <input
                    value={name}
                    onChange={(event) =>
                      setNames((previous) =>
                        previous.map((value, index) =>
                          index === i ? event.target.value : value,
                        ),
                      )
                    }
                    maxLength={100}
                    placeholder={"Partner " + (i + 1)}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
            <p>
              Personalize the archival card. Names are not used to sign in or
              saved.
            </p>
          </fieldset>
          {created && (
            <p className={styles.success} role="status">
              Your account is ready. Sign in to your new workspace.
            </p>
          )}
          <LoginForm />
          <p className={styles.assistance}>
            New here? <Link href="/signup">Create a couple account</Link>
          </p>
          <div className={styles.guestNote}>
            <p className="eyebrow">Attending as a guest?</p>
            <p>
              Guests don’t need an account. Open the family invitation link
              shared directly by the couple.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
