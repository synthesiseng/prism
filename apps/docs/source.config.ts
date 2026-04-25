import {
  defineConfig,
  defineDocs,
  type DocsCollection,
  type frontmatterSchema,
  type metaSchema
} from "fumadocs-mdx/config";

export const docs: DocsCollection<typeof frontmatterSchema, typeof metaSchema> = defineDocs({
  dir: "content/docs"
});

export default defineConfig();
