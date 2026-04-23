export type ShaderEffectName = "none" | "hologram" | "scanline";

export type ShaderEffect = Readonly<{
  name: ShaderEffectName;
  intensity: number;
}>;

export const noEffect: ShaderEffect = {
  name: "none",
  intensity: 0
};

export function hologramEffect(intensity = 0.35): ShaderEffect {
  return {
    name: "hologram",
    intensity
  };
}
