import { Client } from "@notionhq/client";
import { NextRequest, NextResponse } from "next/server";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

interface SpreadData {
  id: string;
  title: string;
  text: string;
  photo: string | null;
  photos: string[];
}

// Placeholder data for when Notion is not configured
const PLACEHOLDER_SPREADS: SpreadData[] = [
  {
    id: "placeholder-0",
    title: "Welcome to the Book",
    text: "This is a placeholder spread. To use real Notion pages, set NOTION_TOKEN and NOTION_PAGE_IDS in your environment variables.\n\nEach spread represents one Notion page, with the hero image spanning both pages and text flowing across the spread.",
    photo: null,
    photos: [],
  },
  {
    id: "placeholder-1",
    title: "Travel Memories",
    text: "Capture your favorite travel moments in this digital book. Each page can contain rich content from your Notion workspace.\n\nImages will span the full spread, creating an immersive reading experience.",
    photo: null,
    photos: [],
  },
  {
    id: "placeholder-2",
    title: "Creative Projects",
    text: "Document your creative journey with photos and stories. The book format makes it feel like a real photo album or scrapbook.\n\nNavigate with arrow keys, touch gestures, or click the edges of the pages.",
    photo: null,
    photos: [],
  },
  {
    id: "placeholder-3",
    title: "Personal Stories",
    text: "Share your personal stories and memories. The two-page spread format allows for rich visual storytelling.\n\nSet up your Notion integration to see your real content here.",
    photo: null,
    photos: [],
  },
];

function extractTextFromBlock(block: any): string {
  if (!block) return "";

  // Handle different block types
  const blockTypes = [
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "toggle",
  ];

  for (const blockType of blockTypes) {
    if (block.type === blockType && block[blockType]?.rich_text) {
      const text = block[blockType].rich_text
        .map((text: any) => text.plain_text)
        .join("");

      // Add extra newlines for headings
      if (blockType.startsWith("heading")) {
        return text + "\n\n";
      }

      // Add newline for list items
      if (blockType.includes("list_item") || blockType === "to_do") {
        return text + "\n";
      }

      return text;
    }
  }

  // Handle quote blocks
  if (block.type === "quote" && block.quote?.rich_text) {
    const text = block.quote.rich_text
      .map((text: any) => text.plain_text)
      .join("");
    return `"${text}"\n`;
  }

  // Handle callout blocks
  if (block.type === "callout" && block.callout?.rich_text) {
    const text = block.callout.rich_text
      .map((text: any) => text.plain_text)
      .join("");
    return `${text}\n`;
  }

  return "";
}

function findAllImageUrls(blocks: any[]): string[] {
  const images: string[] = [];
  for (const block of blocks) {
    if (block.type === "image") {
      if (block.image?.external?.url) {
        images.push(block.image.external.url);
      }
      if (block.image?.file?.url) {
        images.push(block.image.file.url);
      }
    }
  }
  return images;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { index: string } }
) {
  const index = parseInt(params.index, 10);

  if (isNaN(index) || index < 0) {
    return NextResponse.json({ error: "out_of_range" }, { status: 404 });
  }

  // Check if Notion is configured
  const notionPageIds = process.env.NOTION_PAGE_IDS;
  const notionToken = process.env.NOTION_TOKEN;
  const defaultSpreadCount = parseInt(
    process.env.NEXT_PUBLIC_DEFAULT_SPREAD_COUNT || "4",
    10
  );

  console.log("Spread API - Environment check:", {
    hasPageIds: !!notionPageIds,
    hasToken: !!notionToken,
    pageIdsLength: notionPageIds?.length || 0,
    tokenLength: notionToken?.length || 0,
    pageIds: notionPageIds ? notionPageIds.substring(0, 20) + "..." : "not set",
    token: notionToken ? notionToken.substring(0, 10) + "..." : "not set",
  });

  if (!notionPageIds || !notionToken) {
    console.log("Using placeholder data - Notion not configured");
    console.log("notionPageIds:", notionPageIds);
    console.log("notionToken:", notionToken);
    // Return placeholder data
    if (index >= defaultSpreadCount) {
      return NextResponse.json({ error: "out_of_range" }, { status: 404 });
    }

    const response = NextResponse.json(PLACEHOLDER_SPREADS[index]);
    response.headers.set(
      "Cache-Control",
      "s-maxage=120, stale-while-revalidate=300"
    );
    return response;
  }

  // Parse Notion page IDs and format them with dashes
  const pageIds = notionPageIds.split(",").map((id) => {
    const trimmed = id.trim();
    // Convert from format: 28eb8a9a157b8075a64ff7264905c7c1
    // To format: 28eb8a9a-157b-8075-a64f-f7264905c7c1
    if (trimmed.length === 32 && !trimmed.includes("-")) {
      return `${trimmed.slice(0, 8)}-${trimmed.slice(8, 12)}-${trimmed.slice(
        12,
        16
      )}-${trimmed.slice(16, 20)}-${trimmed.slice(20)}`;
    }
    return trimmed;
  });

  if (index >= pageIds.length) {
    return NextResponse.json({ error: "out_of_range" }, { status: 404 });
  }

  const pageId = pageIds[index];

  try {
    // First, get the page to extract the title
    const page = await notion.pages.retrieve({ page_id: pageId });

    // Get page title
    let title = "Untitled";
    if ("properties" in page) {
      if (
        page.properties?.title &&
        "title" in page.properties.title &&
        page.properties.title.title?.[0]?.plain_text
      ) {
        title = page.properties.title.title[0].plain_text;
      } else if (
        page.properties?.Name &&
        "title" in page.properties.Name &&
        page.properties.Name.title?.[0]?.plain_text
      ) {
        title = page.properties.Name.title[0].plain_text;
      }
    }

    // Fetch page blocks using the blocks children API
    const blocksResponse = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100, // Get up to 100 blocks
    });

    const blocks = blocksResponse.results;
    console.log("Fetched blocks:", blocks.length, "blocks from page:", pageId);

    // Debug: log block types
    blocks.forEach((block, index) => {
      console.log(`Block ${index}:`, block.type, block);
    });

    // Extract text content
    let text = "";
    for (const block of blocks) {
      const blockText = extractTextFromBlock(block);
      if (blockText) {
        text += blockText + "\n";
      }
    }

    console.log("Extracted text:", text);
    console.log("Text length:", text.length);

    // If no text was extracted, add some fallback content
    if (text.trim().length === 0) {
      text = `Welcome to ${title}!\n\nThis page contains beautiful imagery and memories. The two-page spread format allows for rich visual storytelling.\n\nAdd text content to your Notion page to see it displayed here.`;
    }

    // Limit text length to ~1000 characters
    if (text.length > 1000) {
      text = text.substring(0, 1000) + "...";
    }

    // Find all images
    const photos = findAllImageUrls(blocks);
    const photo = photos.length > 0 ? photos[0] : null; // Keep first image as hero

    const spreadData: SpreadData = {
      id: pageId,
      title,
      text: text.trim(),
      photo,
      photos,
    };

    const response = NextResponse.json(spreadData);
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400, max-age=1800"
    );
    return response;
  } catch (error) {
    console.error("Error fetching Notion page:", error);
    // Fall back to placeholder data
    if (index < PLACEHOLDER_SPREADS.length) {
      const response = NextResponse.json(PLACEHOLDER_SPREADS[index]);
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400, max-age=1800"
      );
      return response;
    }
    return NextResponse.json(
      { error: "Failed to fetch spread" },
      { status: 500 }
    );
  }
}
