import { phoneDigits } from "./soldierUpdate.js";

// Phone numbers in international form (972501234567): no dashes, spaces or leading zero.
// People without a usable number are skipped and duplicates are removed.
export function selectedNumbers(people) {
  return [...new Set(people.map((p) => phoneDigits(p.phone)).filter((d) => d.length >= 9))];
}

// One number per line, ready to paste.
export const formatNumbers = (numbers) => numbers.join("\n");
