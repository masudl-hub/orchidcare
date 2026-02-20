import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

export const plants = [
  { src: "/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_transparent.png", alt: "Purple orchid", route: "/", label: "meet orchid", action: "start" },
  { src: "/plant_assets_art/Snake_plant_2/Snake_plant_transparent.png", alt: "Snake plant", route: "/proposal", label: "why this, now" },
  { src: "/tools_art/watering_can/watering_can_transparent.png", alt: "Watering can", route: "/get-demo", label: "try it out", scale: 1.4 },
  { src: "/plant_assets_art/jewel_orchid_in_terrarium/jewel_orchid_in_terrarium_transparent.png", alt: "Jewel orchid in terrarium", route: "/login", label: "welcome back" },
  { src: "/tools_art/gardening_apron/gardening_apron_transparent.png", alt: "Gardening apron", route: "/pvp", label: "plants vs pests" },
  { src: "/plant_assets_art/T_Monstera_Albo/Monstera_Albo_transparent.png", alt: "Monstera Albo", route: "/namer", label: "name your plant" },
  { src: "/tools_art/gardening_gloves/gardening_gloves_transparent.png", alt: "Gardening gloves", route: "/doger", label: "plants do move" },
  { src: "/botanical-pixels/93dae5631bdd5ebffbdd38f9b27ffb732cef3e4c.png", alt: "Pruning shears", route: "/begin", label: "start growing" },
];

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 280;

interface PlantCarouselProps {
  activeIndex: number;
  width?: number;
  height?: number;
}

export function PlantCarousel({ activeIndex, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }: PlantCarouselProps) {
  const count = plants.length;

  return (
    <div
      className="relative z-10"
      style={{
        height,
        width,
      }}
    >
      {plants.map((plant, i) => {
        // Calculate shortest offset for looping
        let offset = i - activeIndex;
        if (offset > count / 2) offset -= count;
        if (offset < -count / 2) offset += count;

        const absOffset = Math.abs(offset);
        const opacity = offset === 0 ? 1 : absOffset === 1 ? 0.2 : 0;
        const itemScale = (offset === 0 ? 1 : 0.6) * ((plant as any).scale ?? 1);
        const translateY = offset * (height * 0.65);
        const isVisible = absOffset <= 1;

        return (
          <div
            key={plant.alt}
            className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
            style={{
              opacity,
              transform: `translateY(${translateY}px) scale(${itemScale})`,
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
