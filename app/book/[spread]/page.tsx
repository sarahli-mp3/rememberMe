"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

interface PhotoWithCaption {
  url: string;
  caption?: string;
}

interface SpreadData {
  id: string;
  title: string;
  text: string;
  photo: string | null;
  photos: string[];
  photosWithCaptions: PhotoWithCaption[];
}

interface SpreadMeta {
  count: number;
}

export default function Spread() {
  const params = useParams<{ spread: string }>();
  const router = useRouter();
  const [totalSpreads, setTotalSpreads] = useState(4); // Default fallback
  const [spreadData, setSpreadData] = useState<SpreadData | null>(null);
  const [loading, setLoading] = useState(true); // Start with true
  const [nextSpreadData, setNextSpreadData] = useState<SpreadData | null>(null);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(
    new Set()
  );
  const [cachedImages, setCachedImages] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWithCaption | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Function to check if image is already cached
  const isImageCached = useCallback((url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      // Use a very short timeout to detect cached images quickly
      const timeout = setTimeout(() => resolve(false), 5);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      img.src = url;
    });
  }, []);

  // Function to immediately check cache for all images in spread data
  const checkImageCacheImmediately = useCallback(
    async (photos: PhotoWithCaption[]) => {
      const imageUrls = photos.map((photo) => photo.url);
      const cachedUrls: string[] = [];

      // Check all images in parallel for immediate cache detection
      const cacheChecks = imageUrls.map(async (url) => {
        if (cachedImages.has(url)) {
          cachedUrls.push(url);
          return url;
        }
        const cached = await isImageCached(url);
        if (cached) {
          cachedUrls.push(url);
          setCachedImages((prev) => new Set(Array.from(prev).concat(url)));
        }
        return cached ? url : null;
      });

      await Promise.all(cacheChecks);

      // Mark all cached images as preloaded immediately
      if (cachedUrls.length > 0) {
        setPreloadedImages(
          (prev) => new Set(Array.from(prev).concat(cachedUrls))
        );
      }
    },
    [cachedImages, isImageCached]
  );

  // Function to preload images with cache detection
  const preloadImages = useCallback(
    async (imageUrls: string[]) => {
      const uncachedUrls: string[] = [];

      // Check which images are already cached
      for (const url of imageUrls) {
        if (!preloadedImages.has(url) && !cachedImages.has(url)) {
          const cached = await isImageCached(url);
          if (cached) {
            setCachedImages((prev) => new Set(Array.from(prev).concat(url)));
            setPreloadedImages((prev) => new Set(Array.from(prev).concat(url)));
          } else {
            uncachedUrls.push(url);
          }
        } else if (cachedImages.has(url)) {
          // Already know it's cached, just mark as preloaded
          setPreloadedImages((prev) => new Set(Array.from(prev).concat(url)));
        }
      }

      // Only preload uncached images
      uncachedUrls.forEach((url) => {
        const img = new window.Image();
        img.onload = () => {
          setPreloadedImages((prev) => new Set(Array.from(prev).concat(url)));
        };
        img.onerror = () => {
          console.warn("Failed to preload image:", url);
        };
        img.src = url;
      });
    },
    [preloadedImages, cachedImages, isImageCached]
  );

  const idx = Math.max(
    0,
    Math.min(totalSpreads - 1, parseInt(params.spread ?? "0", 10) || 0)
  );

  const [anim, setAnim] = useState<"none" | "next" | "prev">("none");
  const lastIdx = useRef(idx);
  const animTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch spread meta data
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const response = await fetch("/api/spread/meta", {
          cache: "default", // Use default browser caching
        });
        if (response.ok) {
          const meta: SpreadMeta = await response.json();
          setTotalSpreads(meta.count);
        }
      } catch (error) {
        console.error("Failed to fetch spread meta:", error);
      }
    };
    fetchMeta();
  }, []);

  // Fetch current spread data
  useEffect(() => {
    const fetchSpread = async () => {
      // Only show loading if we don't have data yet
      if (!spreadData) {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/spread/${idx}`, {
          cache: "default", // Use default browser caching
        });
        if (response.ok) {
          const data: SpreadData = await response.json();
          setSpreadData(data);

          // Immediately check for cached images and preload others
          if (data.photosWithCaptions && data.photosWithCaptions.length > 0) {
            // First, immediately check cache for instant display
            checkImageCacheImmediately(data.photosWithCaptions);
            // Then preload any uncached images
            preloadImages(data.photosWithCaptions.map((photo) => photo.url));
          }

          setLoading(false);
        } else {
          console.error("Failed to fetch spread data:", response.status);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch spread:", error);
        setLoading(false);
      }
    };

    fetchSpread();
  }, [idx, preloadImages, spreadData]);

  // Preload next spread
  useEffect(() => {
    if (idx + 1 < totalSpreads) {
      const preloadNext = async () => {
        try {
          const response = await fetch(`/api/spread/${idx + 1}`, {
            cache: "default", // Use default browser caching
          });
          if (response.ok) {
            const data: SpreadData = await response.json();
            setNextSpreadData(data);

            // Preload images for next spread
            if (data.photosWithCaptions && data.photosWithCaptions.length > 0) {
              checkImageCacheImmediately(data.photosWithCaptions);
              preloadImages(data.photosWithCaptions.map((photo) => photo.url));
            }
          }
        } catch (error) {
          console.error("Failed to preload next spread:", error);
        }
      };
      preloadNext();
    } else {
      setNextSpreadData(null);
    }
  }, [idx, totalSpreads, preloadImages]);

  useEffect(() => {
    const dir =
      idx > lastIdx.current ? "next" : idx < lastIdx.current ? "prev" : "none";

    if (dir !== "none") {
      // Clear any existing timeout
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }

      setAnim(dir as any);
      animTimeoutRef.current = setTimeout(() => {
        setAnim("none");
        animTimeoutRef.current = null;
      }, 1000); // Give extra time for animation to complete

      lastIdx.current = idx;
    }

    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
    };
  }, [idx]);

  const go = useCallback(
    (delta: number) => {
      const target = Math.min(totalSpreads - 1, Math.max(0, idx + delta));
      if (target !== idx) {
        // Trigger animation immediately
        const dir = delta > 0 ? "next" : "prev";
        setAnim(dir as any);

        // Clear any existing timeout
        if (animTimeoutRef.current) {
          clearTimeout(animTimeoutRef.current);
        }

        // Delay route change until animation is mostly complete
        setTimeout(() => {
          router.push(`/book/${target}`);
        }, 400); // Wait for most of the 0.5s animation to complete

        animTimeoutRef.current = setTimeout(() => {
          setAnim("none");
          animTimeoutRef.current = null;
        }, 1000); // Give extra time for animation to complete
      }
    },
    [idx, totalSpreads, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && idx < totalSpreads - 1) go(1);
      if (e.key === "ArrowLeft" && idx > 0) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, totalSpreads, go]);

  let touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -40 && idx < totalSpreads - 1) go(1);
    if (dx > 40 && idx > 0) go(-1);
    touchX.current = null;
  }

  const onClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width * 0.66 && idx < totalSpreads - 1) {
      go(1);
    } else if (x < rect.width * 0.33 && idx > 0) {
      go(-1);
    }
  };

  const handlePhotoClick = (photo: PhotoWithCaption, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent page navigation
    setSelectedPhoto(photo);
    setIsModalOpen(true);
    setIsFlipped(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  // Function to limit text to 2 words max
  const truncateText = (text: string, maxWords: number = 2) => {
    const words = text.split(" ");
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(" ") + "...";
  };

  const bgSheets = useMemo(() => Array.from({ length: 16 }), []);

  return (
    <main
      className="stage"
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ cursor: "pointer" }}
    >
      <div className="book">
        <div className="spine" />
        {bgSheets.map((_, i) => (
          <div
            key={i}
            className="bg-sheet"
            style={{ transform: `translateZ(${-i * 0.8}px)` }}
          />
        ))}
        <section className="spread">
          {/* Tab with Notion page title - positioned outside page container */}
          {spreadData?.title && (
            <div className="page-tab">
              <span className="tab-label">{spreadData.title}</span>
            </div>
          )}

          <div className="page left blank" aria-label={`Spread ${idx} left`}>
            {/* Photo grid on left page */}
            {spreadData?.photosWithCaptions &&
              spreadData.photosWithCaptions.length > 0 && (
                <div className="photo-grid">
                  {spreadData.photosWithCaptions
                    .slice(
                      0,
                      Math.ceil(spreadData.photosWithCaptions.length / 2)
                    )
                    .map((photo, photoIndex) => (
                      <div
                        key={photoIndex}
                        className="photo-item"
                        onClick={(e) => handlePhotoClick(photo, e)}
                        style={{ cursor: "pointer" }}
                      >
                        <Image
                          src={photo.url}
                          alt={`${spreadData.title} - Photo ${photoIndex + 1}`}
                          width={120}
                          height={160}
                          className="photo-image"
                          priority={photoIndex === 0}
                          {...(photoIndex === 0
                            ? {}
                            : {
                                loading:
                                  cachedImages.has(photo.url) ||
                                  preloadedImages.has(photo.url)
                                    ? "eager"
                                    : "lazy",
                              })}
                        />
                        {photo.caption && (
                          <div className="photo-caption">
                            {truncateText(photo.caption, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
          </div>

          <div className="page right blank" aria-label={`Spread ${idx} right`}>
            {/* Photo grid on right page */}
            {spreadData?.photosWithCaptions &&
              spreadData.photosWithCaptions.length > 1 && (
                <div className="photo-grid">
                  {spreadData.photosWithCaptions
                    .slice(Math.ceil(spreadData.photosWithCaptions.length / 2))
                    .map((photo, photoIndex) => (
                      <div
                        key={photoIndex}
                        className="photo-item"
                        onClick={(e) => handlePhotoClick(photo, e)}
                        style={{ cursor: "pointer" }}
                      >
                        <Image
                          src={photo.url}
                          alt={`${spreadData.title} - Photo ${
                            Math.ceil(
                              spreadData.photosWithCaptions.length / 2
                            ) +
                            photoIndex +
                            1
                          }`}
                          width={120}
                          height={160}
                          className="photo-image"
                          loading={
                            cachedImages.has(photo.url) ||
                            preloadedImages.has(photo.url)
                              ? "eager"
                              : "lazy"
                          }
                        />
                        {photo.caption && (
                          <div className="photo-caption">
                            {truncateText(photo.caption, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
          </div>
          {anim === "next" && (
            <div className="turn turn-next" style={{ right: 0, left: "auto" }}>
              <div className="turn-face front" />
              <div className="turn-face back" />
              <div className="fold-shadow" />
              <div className="edge-highlight" />
              <div className="page-curl" />
            </div>
          )}
          {anim === "prev" && (
            <div
              style={{
                left: 0,
                right: "auto",
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "50%",
                transformOrigin: "right center",
                transformStyle: "preserve-3d",
                animation:
                  "flipLeftPage 1.2s cubic-bezier(0.25, 0.8, 0.3, 1) both",
                zIndex: 10,
                perspective: "1000px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  background: "var(--paper)",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                  borderRadius: "10px",
                  boxShadow: "0 18px 40px var(--shadow)",
                  overflow: "hidden",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  background: "linear-gradient(#fff7ea, #fff2dd)",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                  borderRadius: "10px",
                  boxShadow: "0 18px 40px var(--shadow)",
                  transform: "rotateY(180deg)",
                }}
              />
            </div>
          )}
        </section>

        {/* Preload next spread's hero image */}
        {nextSpreadData?.photo && idx + 1 < totalSpreads && (
          <div
            style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
          >
            <Image
              src={nextSpreadData.photo}
              alt=""
              width={1}
              height={1}
              priority
            />
          </div>
        )}
      </div>

      {/* Polaroid Modal */}
      {isModalOpen && selectedPhoto && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div
              className={`polaroid-modal ${isFlipped ? "flipped" : ""}`}
              onClick={handleFlip}
            >
              {/* Front of polaroid */}
              <div className="polaroid-front">
                <Image
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption || "Photo"}
                  width={300}
                  height={400}
                  className="modal-photo-image"
                  priority
                  loading="eager"
                />
              </div>

              {/* Back of polaroid */}
              <div className="polaroid-back">
                <div className="polaroid-back-content">
                  {selectedPhoto.caption && (
                    <div className="modal-caption">{selectedPhoto.caption}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
