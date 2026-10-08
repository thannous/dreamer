import { execFileSync } from "node:child_process";

// Vercel Ignored Build Step: exit 0 skips the build, exit 1 continues.
// The Hobby team's 10 GB Deployment Storage quota fills up with production
// builds that change nothing users see, so pushes confined to docs, tests, CI
// and agent tooling skip. Compare with the last successful deployment when
// Vercel provides it (one push may hold several commits), else with HEAD^.
// Unknown paths, missing history or any Git error always build.
const internalPrefixes = [
  "docs/",
  "docs-src/",
  "doc_web_interne/",
  "tools/",
  "tests/",
  "e2e/",
  ".circleci/",
  ".github/",
  ".claude/",
  ".agents/",
];

const isInternal = (file) =>
  file.endsWith(".md") ||
  internalPrefixes.some((prefix) => file.startsWith(prefix));

const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
const base = /^[a-f0-9]{40}$/i.test(previous ?? "") ? previous : "HEAD^";

try {
  const files = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", base, "HEAD", "--"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
    .split("\0")
    .filter(Boolean);
  const relevant = files.filter((file) => !isInternal(file));
  if (relevant.length) {
    console.log(
      `BUILD: ${relevant.length} of ${files.length} changed files may affect the web app.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `SKIP: ${files.length} changed files limited to docs, tests, CI or tooling.`,
    );
    process.exitCode = 0;
  }
} catch {
  console.log(
    `BUILD: could not compute the diff from ${base}; keep the deployment.`,
  );
  process.exitCode = 1;
}
