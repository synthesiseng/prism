import type { CapturedUiSurface, DomSurfaceSnapshot, DomTextureAdapter } from "./types";

export type ExperimentalTexElementImage2D = (
  target: GLenum,
  level: GLint,
  internalformat: GLint,
  format: GLenum,
  type: GLenum,
  element: Element
) => void;

export type ExperimentalWebGlContext = WebGL2RenderingContext & {
  texElementImage2D?: ExperimentalTexElementImage2D;
};

export class NativeHtmlTextureUnavailableError extends Error {
  constructor() {
    super("Native HTML-to-WebGL texture capture is not available in this browser.");
  }
}

export class ExperimentalHtmlTextureAdapter implements DomTextureAdapter {
  capture(surface: DomSurfaceSnapshot): CapturedUiSurface {
    void surface;
    throw new NativeHtmlTextureUnavailableError();
  }

  static isAvailable(gl: WebGL2RenderingContext): gl is ExperimentalWebGlContext {
    return "texElementImage2D" in gl && typeof gl.texElementImage2D === "function";
  }
}
