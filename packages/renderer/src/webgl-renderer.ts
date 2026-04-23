import type { QuadOptions, Renderer2D, Rgba, TextureHandle } from "./render-types";
import { createProgram } from "./shader";

type TextureRecord = Readonly<{
  handle: TextureHandle;
  texture: WebGLTexture;
}>;

const vertexSource = `#version 300 es
precision highp float;

in vec2 aUnit;

uniform vec2 uResolution;
uniform vec4 uRect;

out vec2 vUv;

void main() {
  vec2 pixel = uRect.xy + (aUnit * uRect.zw);
  vec2 zeroToOne = pixel / uResolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;

  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  vUv = aUnit;
}
`;

const fragmentSource = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform float uOpacity;
uniform bool uUseTexture;
uniform sampler2D uTexture;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec4 sampled = uUseTexture ? texture(uTexture, vUv) : vec4(1.0);
  outColor = sampled * uColor * uOpacity;
}
`;

export class WebGlRenderer implements Renderer2D {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly textures = new Map<number, TextureRecord>();
  private readonly uniforms: {
    resolution: WebGLUniformLocation;
    rect: WebGLUniformLocation;
    color: WebGLUniformLocation;
    opacity: WebGLUniformLocation;
    useTexture: WebGLUniformLocation;
    texture: WebGLUniformLocation;
  };
  private nextTextureId = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true
    });

    if (!gl) {
      throw new Error("Prism requires WebGL2 for the default renderer.");
    }

    this.gl = gl;
    this.program = createProgram(gl, vertexSource, fragmentSource);
    this.vao = this.createQuadGeometry();
    this.uniforms = {
      resolution: requiredUniform(gl, this.program, "uResolution"),
      rect: requiredUniform(gl, this.program, "uRect"),
      color: requiredUniform(gl, this.program, "uColor"),
      opacity: requiredUniform(gl, this.program, "uOpacity"),
      useTexture: requiredUniform(gl, this.program, "uUseTexture"),
      texture: requiredUniform(gl, this.program, "uTexture")
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  beginFrame(clearColor: Rgba): void {
    this.resizeToDisplaySize();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  createTexture(width: number, height: number): TextureHandle {
    const gl = this.gl;
    const texture = gl.createTexture();

    const handle: TextureHandle = {
      id: this.nextTextureId,
      width,
      height
    };
    this.nextTextureId += 1;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    this.textures.set(handle.id, { handle, texture });
    return handle;
  }

  updateTexture(source: CanvasImageSource, handle?: TextureHandle): TextureHandle {
    const width = getSourceWidth(source);
    const height = getSourceHeight(source);
    const textureHandle =
      handle && handle.width === width && handle.height === height
        ? handle
        : this.createTexture(width, height);
    const record = this.textures.get(textureHandle.id);

    if (!record) {
      throw new Error(`Texture ${String(textureHandle.id)} does not exist.`);
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, record.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    assertWebGlTextureSource(source);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return textureHandle;
  }

  drawQuad(options: QuadOptions): void {
    const gl = this.gl;
    const color = options.color ?? [1, 1, 1, 1];
    const opacity = options.opacity ?? 1;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform4f(
      this.uniforms.rect,
      options.rect.x,
      options.rect.y,
      options.rect.width,
      options.rect.height
    );
    gl.uniform4f(this.uniforms.color, color[0], color[1], color[2], color[3]);
    gl.uniform1f(this.uniforms.opacity, opacity);

    if (options.texture) {
      const record = this.textures.get(options.texture.id);
      if (!record) {
        throw new Error(`Texture ${String(options.texture.id)} does not exist.`);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, record.texture);
      gl.uniform1i(this.uniforms.texture, 0);
      gl.uniform1i(this.uniforms.useTexture, 1);
    } else {
      gl.uniform1i(this.uniforms.useTexture, 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private resizeToDisplaySize(): void {
    const dpr = globalThis.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private createQuadGeometry(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();

    const vertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
    const location = gl.getAttribLocation(this.program, "aUnit");

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return vao;
  }
}

function requiredUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Missing shader uniform ${name}.`);
  }
  return location;
}

function getSourceWidth(source: CanvasImageSource): number {
  if (hasNumberProperty(source, "displayWidth") && source.displayWidth > 0) {
    return source.displayWidth;
  }
  if ("videoWidth" in source && source.videoWidth > 0) {
    return source.videoWidth;
  }
  if ("naturalWidth" in source && source.naturalWidth > 0) {
    return source.naturalWidth;
  }
  if (hasNumberProperty(source, "width")) {
    return source.width;
  }
  throw new Error("Texture source does not expose a usable width.");
}

function getSourceHeight(source: CanvasImageSource): number {
  if (hasNumberProperty(source, "displayHeight") && source.displayHeight > 0) {
    return source.displayHeight;
  }
  if ("videoHeight" in source && source.videoHeight > 0) {
    return source.videoHeight;
  }
  if ("naturalHeight" in source && source.naturalHeight > 0) {
    return source.naturalHeight;
  }
  if (hasNumberProperty(source, "height")) {
    return source.height;
  }
  throw new Error("Texture source does not expose a usable height.");
}

function hasNumberProperty<TProperty extends string>(
  value: object,
  property: TProperty
): value is Record<TProperty, number> {
  return property in value && typeof value[property as keyof typeof value] === "number";
}

function assertWebGlTextureSource(
  source: CanvasImageSource
): asserts source is Exclude<CanvasImageSource, SVGImageElement> {
  if (typeof SVGImageElement !== "undefined" && source instanceof SVGImageElement) {
    throw new Error("SVGImageElement sources must be rasterized before WebGL upload.");
  }
}
