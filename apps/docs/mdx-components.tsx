import defaultMdxComponents from "fumadocs-ui/mdx";

type DocsMdxComponents = typeof defaultMdxComponents;

export function getMDXComponents(
  components?: Partial<DocsMdxComponents>
): DocsMdxComponents {
  return {
    ...defaultMdxComponents,
    ...components
  };
}
