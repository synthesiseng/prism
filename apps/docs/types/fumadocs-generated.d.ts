import type { StaticSource, MetaData, PageData } from "fumadocs-core/source";
import type { ComponentProps, ComponentType } from "react";
import type { DocsPage } from "fumadocs-ui/layouts/docs/page";

type DocsMdxComponent = ComponentType<{
  components?: Record<string, unknown>;
}>;

type DocsPageData = PageData & {
  title: string;
  description?: string;
  body: DocsMdxComponent;
  toc: ComponentProps<typeof DocsPage>["toc"];
};

type DocsMetaData = MetaData;

declare module "collections/server" {
  export const docs: {
    toFumadocsSource(): StaticSource<{
      pageData: DocsPageData;
      metaData: DocsMetaData;
    }>;
  };
}
