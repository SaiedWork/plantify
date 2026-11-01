"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string };

/** Main image with a thumbnail strip; a product holds at most 4 images. */
export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/5">
        {current && (
          <Image src={current.url} alt={current.alt || name} fill unoptimized priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        )}
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-pressed={i === index}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg bg-muted opacity-70 outline-none ring-1 ring-foreground/10 hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
                  i === index && "opacity-100 ring-2 ring-green-700 dark:ring-green-500",
                )}
              >
                <Image src={img.url} alt="" fill unoptimized sizes="12vw" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
