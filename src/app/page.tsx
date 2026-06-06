import { APP_NAME, APP_TAGLINE, getAppShellDescription } from "@/lib/app-info";

const SOURCE_DIRS = [
  "app",
  "components",
  "domain",
  "server",
  "providers",
  "workers",
  "lib",
  "test",
] as const;

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          maxWidth: "42rem",
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--accent-muted)",
          borderRadius: "1rem",
          padding: "2.5rem",
          boxShadow: "0 12px 40px rgba(44, 40, 37, 0.08)",
        }}
      >
        <p
          style={{
            color: "var(--accent)",
            fontSize: "0.875rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}
        >
          P0 Foundation
        </p>
        <h1 style={{ fontSize: "2.25rem", marginBottom: "0.5rem" }}>{APP_NAME}</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>{APP_TAGLINE}</p>
        <p style={{ marginBottom: "1.5rem" }}>{getAppShellDescription()}</p>
        <div
          style={{
            background: "var(--background)",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Source layout ready for follow-up PRs:
          </p>
          <code style={{ fontSize: "0.875rem" }}>src/{`{${SOURCE_DIRS.join(", ")}}`}</code>
        </div>
      </section>
    </main>
  );
}
