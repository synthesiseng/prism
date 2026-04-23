export type Mat4Array = Float32Array & { readonly length: 16 };

export function identityMat4(): Mat4Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) as Mat4Array;
}

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
