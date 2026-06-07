/** Auth route-group layout — pass-through. Each page owns its own background. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
