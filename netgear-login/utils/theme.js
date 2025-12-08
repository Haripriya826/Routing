// src/utils/theme.js
export const THEMES = { SYSTEM: "system", DARK: "dark", LIGHT: "light" };

export function applyTheme(value) {
  if (value === THEMES.SYSTEM) {
    document.documentElement.classList.remove("theme-dark");
    document.documentElement.classList.remove("theme-light");
  } else if (value === THEMES.DARK) {
    document.documentElement.classList.add("theme-dark");
    document.documentElement.classList.remove("theme-light");
  } else if (value === THEMES.LIGHT) {
    document.documentElement.classList.add("theme-light");
    document.documentElement.classList.remove("theme-dark");
  }
}
