import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  // Set by pages that turn signed-out visitors away, so logging in lands
  // back where they were going. Validated in the action, not here.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <LoginForm next={next} />
    </div>
  );
}
