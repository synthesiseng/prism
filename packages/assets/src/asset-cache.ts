export class AssetCache<TAsset> {
  private readonly assets = new Map<string, TAsset>();

  get(key: string): TAsset | undefined {
    return this.assets.get(key);
  }

  set(key: string, asset: TAsset): void {
    this.assets.set(key, asset);
  }

  has(key: string): boolean {
    return this.assets.has(key);
  }

  clear(): void {
    this.assets.clear();
  }
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  await image.decode();
  return image;
}
