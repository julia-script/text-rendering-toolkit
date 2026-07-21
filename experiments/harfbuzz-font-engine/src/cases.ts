import type {ShapeInput} from "./font-engine.js";

export interface ShapeCase {
  readonly id: string;
  readonly fixtureId: string;
  readonly input: ShapeInput;
}

export const shapeCases: readonly ShapeCase[] = [
  {
    id: "latin-ligature",
    fixtureId: "noto-sans-variable-ttf",
    input: {text: "office café", direction: "ltr", script: "Latn", language: "en", features: ["liga=1"]},
  },
  {
    id: "combining-mark",
    fixtureId: "noto-sans-variable-ttf",
    input: {text: "A\u0301", direction: "ltr", script: "Latn", language: "en"},
  },
  {
    id: "arabic-rtl",
    fixtureId: "noto-sans-arabic-variable",
    input: {text: "السَّلَامُ عَلَيْكُمْ", direction: "rtl", script: "Arab", language: "ar"},
  },
  {
    id: "mixed-direction-latin-run",
    fixtureId: "noto-sans-variable-ttf",
    input: {text: "WebGPU ", direction: "ltr", script: "Latn", language: "en"},
  },
  {
    id: "mixed-direction-arabic-run",
    fixtureId: "noto-sans-arabic-variable",
    input: {text: "مرحبا", direction: "rtl", script: "Arab", language: "ar"},
  },
  {
    id: "devanagari",
    fixtureId: "noto-sans-devanagari-variable",
    input: {text: "नमस्ते दुनिया", direction: "ltr", script: "Deva", language: "hi"},
  },
  {
    id: "khmer",
    fixtureId: "noto-sans-khmer-variable",
    input: {text: "សួស្តី​ពិភពលោក", direction: "ltr", script: "Khmr", language: "km"},
  },
  {
    id: "supplementary-plane",
    fixtureId: "noto-sans-symbols2",
    input: {text: "𐅀", direction: "ltr", script: "Grek", language: "el"},
  },
];
