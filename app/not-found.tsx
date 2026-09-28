import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container empty-page">
      <h1>404 · Page not found</h1>
      <p className="muted">That lesson doesn’t exist (yet).</p>
      <Link className="button primary" href="/">
        Back to all lessons
      </Link>
    </div>
  );
}
