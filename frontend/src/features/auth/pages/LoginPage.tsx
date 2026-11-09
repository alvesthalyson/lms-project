import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { toApiError } from "@/api/errors";
import { FormField, fieldA11y } from "@/components/FormField";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapApiErrorToForm } from "@/lib/form-errors";

import { useAuth } from "../hooks";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Where to go after signing in: the page the user was redirected from, or the catalogue. */
function useReturnPath(): string {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  return from?.pathname ? `${from.pathname}${from.search ?? ""}` : "/books";
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = useReturnPath();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  if (status === "authenticated") return <Navigate to={returnPath} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      navigate(returnPath, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "no_active_account") {
        setFormError("Invalid email or password.");
        return;
      }
      const mapped = mapApiErrorToForm(apiError, ["email", "password"]);
      for (const field of mapped.fields) {
        setError(field.name as keyof LoginValues, { type: "server", message: field.message });
      }
      setFormError(mapped.formError);
    }
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your library account.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="destructive">{formError}</Alert>}

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            {...register("email")}
            {...fieldA11y("email", errors.email?.message)}
            type="email"
            autoComplete="username"
          />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            {...register("password")}
            {...fieldA11y("password", errors.password?.message)}
            type="password"
            autoComplete="current-password"
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" state={location.state} className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
