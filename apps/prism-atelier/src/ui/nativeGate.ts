export function showNativeGate(): void {
  const gate = document.getElementById("nativeGate");
  if (!gate) {
    throw new Error("Missing native support gate.");
  }
  gate.hidden = false;
}

export function hideNativeGate(): void {
  const gate = document.getElementById("nativeGate");
  if (!gate) {
    throw new Error("Missing native support gate.");
  }
  gate.hidden = true;
}
