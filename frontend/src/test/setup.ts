import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// The first test of a file runs cold (modules compile on demand) and can take over a second on a busy
// machine, which is longer than Testing Library's default 1 s wait for async queries.
configure({ asyncUtilTimeout: 4000 });

// Vitest runs without globals, so Testing Library's automatic cleanup is not registered: do it here.
afterEach(() => {
  cleanup();
});
