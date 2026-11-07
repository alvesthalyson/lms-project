import { Link } from "react-router-dom";

import { useCategories } from "@/features/books/hooks";

import { HALL_SLOTS } from "../art/hall";
import { CategoryCard } from "../components/CategoryCard";
import { HallShelf } from "../components/HallShelf";
import { copy } from "../copy";

/**
 * The hall: every category is a bookcase of the painted hall (up to HALL_SLOTS.length of them) and links to its shelf.
 * On narrow screens, where the painting is cropped, the same categories appear as glass cards.
 * Categories come from the API, so a new category becomes a new shelf with no code change.
 */
export function HallPage() {
  const { data, isLoading, isError, refetch } = useCategories();
  const categories = data?.results ?? [];
  const half = Math.ceil(categories.length / 2);

  return (
    <main className="lib-hall" aria-labelledby="hall-title">
      <header className="lib-hall-head">
        <h1 id="hall-title">{copy.name}</h1>
        <p>{copy.hall.subtitle}</p>
      </header>

      {isLoading && <p className="lib-hall-foot" role="status">{copy.hall.loading}</p>}

      {isError && (
        <div className="lib-stage" style={{ display: "grid", placeItems: "center" }}>
          <div className="lib-empty" role="alert">
            <p>{copy.hall.error}</p>
            <button type="button" className="lib-back" style={{ marginTop: 12 }} onClick={() => void refetch()}>
              {copy.hall.retry}
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && categories.length === 0 && (
        <div className="lib-stage" style={{ display: "grid", placeItems: "center" }}>
          <p className="lib-empty">{copy.hall.empty}</p>
        </div>
      )}

      {categories.length > 0 && (
        <nav className="lib-shelves" aria-label={copy.hall.subtitle}>
          <div className="lib-cover">
            {categories.slice(0, HALL_SLOTS.length).map((category, i) => {
              const slot = HALL_SLOTS[i];
              return slot ? <HallShelf key={category.id} category={category} slot={slot} position={i + 1} /> : null;
            })}
          </div>
        </nav>
      )}

      {categories.length > 0 && (
        <div className="lib-stage lib-stage--cards">
          <nav className="lib-col" data-side="left" aria-label={copy.hall.subtitle}>
            {categories.slice(0, half).map((category, i) => (
              <CategoryCard key={category.id} category={category} position={i + 1} />
            ))}
          </nav>
          <div className="lib-mid" aria-hidden />
          <nav className="lib-col" data-side="right" aria-label={copy.hall.subtitle}>
            {categories.slice(half).map((category, i) => (
              <CategoryCard key={category.id} category={category} position={half + i + 1} />
            ))}
          </nav>
        </div>
      )}

      <p className="lib-hall-foot">
        {copy.hall.hint} · <Link to="/books">{copy.hall.counterLink}</Link>
      </p>
    </main>
  );
}
