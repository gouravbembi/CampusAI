import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { App } from "./App";

test("exposes the placement overview and all four roles", () => {
  const markup = renderToStaticMarkup(<App />);
  expect(markup).toContain("From campus to career.");
  expect(markup).toContain('href="#roles"');
  expect(markup).toContain('id="roles"');
  for (const role of ["Student", "Recruiter", "Placement Officer", "Administrator"]) {
    expect(markup).toContain(`>${role}</h3>`);
  }
});
