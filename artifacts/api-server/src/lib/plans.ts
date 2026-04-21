export type PlanId = "free" | "starter" | "lite" | "elite" | "infinity" | "infinity_pro" | "super_veo";

export interface PlanDef {
  name: string;
  price: number;
  currency: string;
  imagesLimit: number;   // -1 = unlimited
  videosLimit: number;
  regenerationsLimit: number;
  threads: number;
  videoResolutions: string[];
  imageResolutions: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    name: "Free",
    price: 0,
    currency: "PKR",
    imagesLimit: -1,
    videosLimit: -1,
    regenerationsLimit: -1,
    threads: 1,
    videoResolutions: ["720p"],
    imageResolutions: ["1K"],
  },
  starter: {
    name: "Starter",
    price: 1500,
    currency: "PKR",
    imagesLimit: 1000,
    videosLimit: 800,
    regenerationsLimit: 1000,
    threads: 4,
    videoResolutions: ["720p"],
    imageResolutions: ["1K"],
  },
  lite: {
    name: "Lite",
    price: 2500,
    currency: "PKR",
    imagesLimit: 1000,
    videosLimit: 1500,
    regenerationsLimit: 1000,
    threads: 4,
    videoResolutions: ["720p"],
    imageResolutions: ["1K"],
  },
  elite: {
    name: "Elite",
    price: 3000,
    currency: "PKR",
    imagesLimit: 1000,
    videosLimit: 2000,
    regenerationsLimit: 1000,
    threads: 4,
    videoResolutions: ["720p"],
    imageResolutions: ["1K"],
  },
  super_veo: {
    name: "Super VEO",
    price: 5000,
    currency: "PKR",
    imagesLimit: 1000,
    videosLimit: -1,
    regenerationsLimit: 1000,
    threads: 4,
    videoResolutions: ["720p"],
    imageResolutions: ["1K"],
  },
  infinity: {
    name: "Infinity",
    price: 7000,
    currency: "PKR",
    imagesLimit: 10000,
    videosLimit: -1,
    regenerationsLimit: 10000,
    threads: 4,
    videoResolutions: ["720p", "4K"],
    imageResolutions: ["1K", "4K"],
  },
  infinity_pro: {
    name: "Infinity Pro",
    price: 15000,
    currency: "PKR",
    imagesLimit: 10000,
    videosLimit: -1,
    regenerationsLimit: 10000,
    threads: 8,
    videoResolutions: ["720p", "4K"],
    imageResolutions: ["1K", "4K"],
  },
};

export function getPlan(planId: string): PlanDef {
  if (planId === "tribe") return PLANS.elite;
  return PLANS[(planId as PlanId)] ?? PLANS.free;
}

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
