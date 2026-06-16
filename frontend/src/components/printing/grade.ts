/**
 * Grade helpers shared by the print-order detail sheet + side grid.
 *
 * The grade is a flat map keyed by `${variationId}|${side}` → `{ planned, printed }`.
 * It is built from the design's variations × enabled sides, then hydrated from
 * an existing order's `outputs`. On submit it is flattened back into the
 * backend's `planned_outputs` / `printed_outputs` lists (skipping zero rows).
 */

import type { Print, PrintSide } from "@/lib/schemas/print";
import type {
  PrintOrder,
  PrintOrderOutputItem,
  PrintOrderPrintedItem,
} from "@/lib/schemas/print-order";

export type GradeCell = { planned: number; printed: number };
export type Grade = Record<string, GradeCell>;

export const gradeKey = (variationId: string, side: PrintSide): string => `${variationId}|${side}`;

/** Sides the design prints on, derived from has_front / has_back. */
export function sidesFor(design: Print | undefined): PrintSide[] {
  if (!design) return [];
  const out: PrintSide[] = [];
  if (design.has_front) out.push("front");
  if (design.has_back) out.push("back");
  return out;
}

/** A zeroed grade for every (variation, enabled side) of the design. */
export function emptyGrade(design: Print | undefined): Grade {
  const grade: Grade = {};
  if (!design) return grade;
  const sides = sidesFor(design);
  for (const v of design.variations) {
    for (const side of sides) {
      grade[gradeKey(v.id, side)] = { planned: 0, printed: 0 };
    }
  }
  return grade;
}

/** Hydrate a grade from an existing order's outputs (overlaid on the empty grade). */
export function gradeFromOrder(design: Print | undefined, order: PrintOrder | null): Grade {
  const grade = emptyGrade(design);
  if (!order) return grade;
  for (const o of order.outputs) {
    grade[gradeKey(o.print_design_variation_id, o.side)] = {
      planned: o.planned_quantity,
      printed: o.printed_quantity,
    };
  }
  return grade;
}

export function cellOf(grade: Grade, variationId: string, side: PrintSide): GradeCell {
  return grade[gradeKey(variationId, side)] ?? { planned: 0, printed: 0 };
}

export function totalOf(grade: Grade, key: keyof GradeCell): number {
  return Object.values(grade).reduce((sum, c) => sum + c[key], 0);
}

/** Flatten the grade into `planned_outputs` (rows with planned > 0). */
export function toPlannedOutputs(grade: Grade): PrintOrderOutputItem[] {
  const out: PrintOrderOutputItem[] = [];
  for (const [k, cell] of Object.entries(grade)) {
    if (cell.planned <= 0) continue;
    const [variationId, side] = k.split("|");
    out.push({
      print_design_variation_id: variationId,
      side: side as PrintSide,
      planned_quantity: cell.planned,
    });
  }
  return out;
}

/** Flatten the grade into `printed_outputs` (every planned row carries its printed count). */
export function toPrintedOutputs(grade: Grade): PrintOrderPrintedItem[] {
  const out: PrintOrderPrintedItem[] = [];
  for (const [k, cell] of Object.entries(grade)) {
    // Keep any row that was planned so the backend can replace its printed count
    // (the DB check enforces printed <= planned; we re-send the planned set).
    if (cell.planned <= 0) continue;
    const [variationId, side] = k.split("|");
    out.push({
      print_design_variation_id: variationId,
      side: side as PrintSide,
      printed_quantity: cell.printed,
    });
  }
  return out;
}
