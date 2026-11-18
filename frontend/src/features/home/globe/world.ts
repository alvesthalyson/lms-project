import { useQuery } from "@tanstack/react-query";

/** One country of /world-countries.json: its centre (lon, lat) and its outlines as flat [lon, lat, ...] rings. */
export interface WorldCountry {
  c: [number, number];
  r: number[][];
}

/** Country outlines keyed by ISO 3166-1 alpha-2. Simplified to 0.1° and served from /public (about 110 kB). */
export type World = Record<string, WorldCountry>;

export async function loadWorld(): Promise<World> {
  const response = await fetch("/world-countries.json");
  if (!response.ok) throw new Error(`world-countries.json: ${response.status}`);
  return (await response.json()) as World;
}

export function useWorld(enabled = true) {
  return useQuery({ queryKey: ["world-countries"], queryFn: loadWorld, staleTime: Infinity, enabled });
}

/** "Brasil", "Japan", "日本": the name of a country in the reader's language, or the code if the browser does not know it. */
export function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The flag as an emoji (two regional-indicator letters). */
export function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
