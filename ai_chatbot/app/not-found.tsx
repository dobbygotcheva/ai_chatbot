import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="font-bold text-6xl text-white">404</h1>
        <p className="mt-4 text-gray-300 text-xl">Page not found</p>
        <p className="mt-2 text-gray-400">
          The page you're looking for doesn't exist.
        </p>
        <Link
          className="mt-8 inline-block rounded-md bg-red-600 px-6 py-3 text-white hover:bg-red-700"
          href="/"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
