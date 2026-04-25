import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle
} from "fumadocs-ui/layouts/docs/page";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/lib/source";
import type { ComponentProps } from "react";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps) {
  const page = source.getPage((await params).slug ?? []);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description
  };
}

export default async function Page({ params }: PageProps) {
  const page = source.getPage((await params).slug ?? []);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;
  const mdxComponents = getMDXComponents() as NonNullable<
    ComponentProps<typeof MDX>["components"]
  >;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description ? (
        <DocsDescription>{page.data.description}</DocsDescription>
      ) : null}
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}
