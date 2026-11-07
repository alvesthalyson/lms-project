import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { toApiError } from "@/api/errors";
import { FormField, fieldA11y } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mapApiErrorToForm } from "@/lib/form-errors";
import { toast } from "@/lib/toast";

import { useBook, useCategories, useCreateBook, useUpdateBook } from "../hooks";
import {
  BOOK_FORM_FIELDS,
  bookFormSchema,
  emptyBookFormValues,
  toBookPayload,
  valuesFromBook,
  type BookFormValues,
} from "../schemas";
import type { Author, Category } from "../types";
import { AuthorPicker } from "./AuthorPicker";

export type BookModalState = { mode: "create" } | { mode: "edit"; bookId: number };

interface BookFormModalProps {
  state: BookModalState;
  onClose: () => void;
}

/**
 * Dialog shell: loads what the form needs (categories; for edit, the book's detail,
 * because list rows do not include `description`) and mounts the form only when it is
 * all there, so `defaultValues` are correct from the first render, with no reset effects.
 */
export function BookFormModal({ state, onClose }: BookFormModalProps) {
  const categories = useCategories();
  const detail = useBook(state.mode === "edit" ? state.bookId : null);

  const ready = categories.isSuccess && (state.mode === "create" || detail.isSuccess);
  const failed = categories.isError || (state.mode === "edit" && detail.isError);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.mode === "create" ? "Add book" : "Edit book"}</DialogTitle>
          <DialogDescription>
            {state.mode === "create"
              ? "Add a title to the catalogue. You can add physical copies now or later."
              : "Update this title's details."}
          </DialogDescription>
        </DialogHeader>

        {ready ? (
          <BookForm
            state={state}
            categories={categories.data.results}
            initialValues={state.mode === "edit" && detail.data ? valuesFromBook(detail.data) : emptyBookFormValues()}
            initialAuthors={state.mode === "edit" && detail.data ? detail.data.authors : []}
            currentCover={state.mode === "edit" && detail.data ? detail.data.cover_image : null}
            onClose={onClose}
          />
        ) : failed ? (
          <Alert variant="destructive" className="flex items-center justify-between gap-3">
            <span>Could not load the form data.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void categories.refetch();
                if (state.mode === "edit") void detail.refetch();
              }}
            >
              Retry
            </Button>
          </Alert>
        ) : (
          <Spinner />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface BookFormProps {
  state: BookModalState;
  categories: Category[];
  initialValues: BookFormValues;
  initialAuthors: Author[];
  currentCover: string | null;
  onClose: () => void;
}

function BookForm({ state, categories, initialValues, initialAuthors, currentCover, onClose }: BookFormProps) {
  const createBook = useCreateBook();
  const updateBook = useUpdateBook();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<BookFormValues>({ resolver: zodResolver(bookFormSchema), defaultValues: initialValues });

  const authorIds = watch("author_ids");
  const pending = createBook.isPending || updateBook.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = toBookPayload(values, state.mode);
    try {
      const saved =
        state.mode === "create"
          ? await createBook.mutateAsync(payload)
          : await updateBook.mutateAsync({ id: state.bookId, payload });
      toast.success(state.mode === "create" ? `"${saved.title}" was added.` : `"${saved.title}" was updated.`);
      onClose();
    } catch (error) {
      // Field errors go under their inputs; everything else becomes the alert at the top of the form.
      const mapped = mapApiErrorToForm(toApiError(error), BOOK_FORM_FIELDS);
      for (const field of mapped.fields) {
        setError(field.name as keyof BookFormValues, { type: "server", message: field.message });
      }
      setFormError(mapped.formError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert variant="destructive">{formError}</Alert>}

      <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
        <Input {...register("title")} {...fieldA11y("title", errors.title?.message)} autoComplete="off" />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="ISBN"
          htmlFor="isbn"
          required
          error={errors.isbn?.message}
          hint="ISBN-10 or ISBN-13, hyphens allowed."
        >
          <Input {...register("isbn")} {...fieldA11y("isbn", errors.isbn?.message)} autoComplete="off" inputMode="text" />
        </FormField>

        <FormField label="Category" htmlFor="category_id" required error={errors.category_id?.message}>
          <Select {...register("category_id")} {...fieldA11y("category_id", errors.category_id?.message)}>
            <option value="">Select a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Publisher" htmlFor="publisher" error={errors.publisher?.message}>
          <Input {...register("publisher")} {...fieldA11y("publisher", errors.publisher?.message)} />
        </FormField>

        <FormField label="Publication year" htmlFor="publication_year" error={errors.publication_year?.message}>
          <Input
            {...register("publication_year")}
            {...fieldA11y("publication_year", errors.publication_year?.message)}
            inputMode="numeric"
            placeholder="e.g. 2017"
          />
        </FormField>
      </div>

      <AuthorPicker
        value={authorIds}
        initialAuthors={initialAuthors}
        error={errors.author_ids?.message}
        onChange={(ids) => setValue("author_ids", ids, { shouldValidate: true, shouldDirty: true })}
      />

      <FormField label="Description" htmlFor="description" error={errors.description?.message}>
        <Textarea {...register("description")} {...fieldA11y("description", errors.description?.message)} rows={4} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Cover image"
          htmlFor="cover_image"
          error={errors.cover_image?.message}
          hint={currentCover ? "Choose a file to replace the current cover. Max 5 MB." : "Optional. Max 5 MB."}
        >
          <Input
            type="file"
            accept="image/*"
            {...fieldA11y("cover_image", errors.cover_image?.message)}
            onChange={(event) =>
              setValue("cover_image", event.target.files?.[0] ?? null, { shouldValidate: true, shouldDirty: true })
            }
          />
        </FormField>

        {state.mode === "create" && (
          <FormField
            label="Initial copies"
            htmlFor="initial_copies"
            error={errors.initial_copies?.message}
            hint="Physical copies to add now (0 to 500)."
          >
            <Input
              {...register("initial_copies")}
              {...fieldA11y("initial_copies", errors.initial_copies?.message)}
              inputMode="numeric"
            />
          </FormField>
        )}
      </div>

      {currentCover && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <img src={currentCover} alt="Current cover" className="h-16 w-12 rounded object-cover" />
          Current cover
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : state.mode === "create" ? "Create book" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
