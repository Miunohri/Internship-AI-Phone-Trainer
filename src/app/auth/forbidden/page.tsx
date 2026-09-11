import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main>
      <h1>Access Denied</h1>
      <p>
        Sorry, you do not have permission to access this page. Please contact
        your system administrator for more information.
      </p>
      <Link href="/">Return to Login</Link>
    </main>
  );
}
