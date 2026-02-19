import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

export const plants = [
  { src: "/plant_assets_art/T_Fiddle_Leaf_Fig/Fiddle_Leaf_Fig_transparent.png", alt: "Fiddle leaf fig", route: "/shop-pots" },
  { src: "/botanical-pixels/e839b599ec5b833edce20318959f88177cdd67b0.png", alt: "Monstera", route: "/care-monstera" },
  { src: "/plant_assets_art/Anthurium/Anthurium_transparent.png", alt: "Anthurium", route: "/identify" },
  { src: "/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_transparent.png", alt: "Purple orchid", route: "/proposal", label: "/549 proposal" },
  { src: "/botanical-pixels/76447a421e3450c5e037b1d46de5c2a6b6bcdc32.png", alt: "String of pearls", route: "/propagate" },
  { src: "/botanical-pixels/aab905513b7dffeced59c17a52d7a39d6e40f77b.png", alt: "Atomizer", route: "/shop-tools" },
  { src: "/botanical-pixels/93dae5631bdd5ebffbdd38f9b27ffb732cef3e4c.png", alt: "Pruning shears", route: "/pruning-101" },
];

const ITEM_HEIGHT = 280;

interface PlantCarouselProps {
  activeIndex: number;
}

export function PlantCarousel({ activeIndex }: PlantCarouselProps) {
  const count = plants.length;

  return (
    <div
      className="relative z-10"
      style={{
        height: ITEM_HEIGHT,
        width: 180,
      }}
    >
      {plants.map((plant, i) => {
        // Calculate shortest offset for looping
        let offset = i - activeIndex;
        if (offset > count / 2) offset -= count;
        if (offset < -count / 2) offset += count;

        const absOffset = Math.abs(offset);
        const opacity = offset === 0 ? 1 : absOffset === 1 ? 0.2 : 0;
        const scale = offset === 0 ? 1 : 0.6;
        const translateY = offset * (ITEM_HEIGHT * 0.65);
        const isVisible = absOffset <= 1;

        return (
          <div
            key={plant.alt}
            className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
            style={{
              opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
              pointerEvents: offset === 0 ? "auto" : "none",
              visibility: isVisible ? "visible" : "hidden",
            }}
          >
            <ImageWithFallback
              src={plant.src}
              alt={plant.alt}
              className="h-full w-auto object-contain"
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}
