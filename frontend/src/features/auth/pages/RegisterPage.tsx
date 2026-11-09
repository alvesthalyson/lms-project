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
import { toast } from "@/lib/toast";

import { useAuth } from "../hooks";

const registerSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    phone: z.string().trim(),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "The passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

const SERVER_FIELDS = ["first_name", "last_name", "email", "phone", "password"] as const;

/** Self-registration: always creates a MEMBER (the API decides the role) and signs the new member in. */
export function RegisterPage() {
  const { status, register: signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const returnPath = from?.pathname ? `${from.pathname}${from.search ?? ""}` : "/";
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: "", last_name: "", email: "", phone: "", password: "", confirm: "" },
  });

  if (status === "authenticated") return <Navigate to={returnPath} replace />;

  const onSubmit = handleSubmit(async ({ confirm: _confirm, phone, ...values }) => {
    setFormError(null);
    try {
      const user = await signUp({ ...values, ...(phone ? { phone } : {}) });
      toast.success(`Welcome, ${user.first_name}! Your card number is ${user.member_number ?? "being prepared"}.`);
      navigate(returnPath, { replace: true });
    } catch (error) {
      const mapped = mapApiErrorToForm(toApiError(error), SERVER_FIELDS);
      for (const field of mapped.fields) {
        setError(field.name as keyof RegisterValues, { type: "server", message: field.message });
      }
      setFormError(mapped.formError);
    }
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">Become a member to borrow and reserve books.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert variant="destructive">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" htmlFor="first_name" error={errors.first_name?.message}>
            <Input {...register("first_name")} {...fieldA11y("first_name", errors.first_name?.message)} autoComplete="given-name" />
          </FormField>
          <FormField label="Last name" htmlFor="last_name" error={errors.last_name?.message}>
            <Input {...register("last_name")} {...fieldA11y("last_name", errors.last_name?.message)} autoComplete="family-name" />
          </FormField>
        </div>

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input {...register("email")} {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="email" />
        </FormField>

        <FormField label="Phone (optional)" htmlFor="phone" error={errors.phone?.message}>
          <Input {...register("phone")} {...fieldA11y("phone", errors.phone?.message)} type="tel" autoComplete="tel" />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <Input {...register("password")} {...fieldA11y("password", errors.password?.message)} type="password" autoComplete="new-password" />
        </FormField>

        <FormField label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input {...register("confirm")} {...fieldA11y("confirm", errors.confirm?.message)} type="password" autoComplete="new-password" />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already a member?{" "}
        <Link to="/login" state={location.state} className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
