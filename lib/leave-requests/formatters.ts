import type { SelectableWard } from "./types";

export function formatSelectableWardLabel(ward: SelectableWard) {
  return ward.name === ward.code ? ward.code : `${ward.code} - ${ward.name}`;
}
