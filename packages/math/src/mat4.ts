/**
 * Float32-backed 4x4 matrix.
 */
export type Mat4Array = Float32Array & { readonly length: 16 };

/**
 * Creates an identity 4x4 matrix.
 *
 * @returns A new identity matrix.
 */
export function identityMat4(): Mat4Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) as Mat4Array;
}

/**
 * Creates an orthographic projection matrix.
 *
 * @param left - Left clipping plane.
 * @param right - Right clipping plane.
 * @param bottom - Bottom clipping plane.
 * @param top - Top clipping plane.
 * @param near - Near clipping plane.
 * @param far - Far clipping plane.
 * @returns A new orthographic projection matrix.
 */
export function orthographicMat4(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Mat4Array {
  const width = right - left;
  const height = top - bottom;
  const depth = far - near;

  return new Float32Array([
    2 / width,
    0,
    0,
    0,
    0,
    2 / height,
    0,
    0,
    0,
    0,
    -2 / depth,
    0,
    -(right + left) / width,
    -(top + bottom) / height,
    -(far + near) / depth,
    1
  ]) as Mat4Array;
}
