import { NextResponse } from "next/server";

export async function GET() {
  try {
    const notionPageIds = process.env.NOTION_PAGE_IDS;
    const notionToken = process.env.NOTION_TOKEN;
    const defaultSpreadCount = parseInt(
      process.env.NEXT_PUBLIC_DEFAULT_SPREAD_COUNT || "4",
      10
    );

    console.log("Meta API - Environment check:", {
      hasPageIds: !!notionPageIds,
      hasToken: !!notionToken,
      pageIdsLength: notionPageIds?.length || 0,
      tokenLength: notionToken?.length || 0,
    });

    let count: number;

    if (!notionPageIds || !notionToken) {
      console.log("Using default count - Notion not configured");
      // Use default count when Notion is not configured
      count = defaultSpreadCount;
    } else {
      console.log("Using Notion page IDs");
      // Parse Notion page IDs and get count
      const pageIds = notionPageIds
        .split(",")
        .map((id) => {
          const trimmed = id.trim();
          // Convert from format: 28eb8a9a157b8075a64ff7264905c7c1
          // To format: 28eb8a9a-157b-8075-a64f-f7264905c7c1
          if (trimmed.length === 32 && !trimmed.includes("-")) {
            return `${trimmed.slice(0, 8)}-${trimmed.slice(
              8,
              12
            )}-${trimmed.slice(12, 16)}-${trimmed.slice(
              16,
              20
            )}-${trimmed.slice(20)}`;
          }
          return trimmed;
        })
        .filter((id) => id.length > 0);
      count = pageIds.length;
      console.log("Parsed page IDs:", pageIds);
    }

    const response = NextResponse.json({ count });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600, max-age=180"
    );
    return response;
  } catch (error) {
    console.error("Error fetching spread meta:", error);
    return NextResponse.json(
      { error: "Failed to fetch spread meta" },
      { status: 500 }
    );
  }
}
