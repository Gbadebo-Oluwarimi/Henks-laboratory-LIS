import { existsSync } from "node:fs";
import path from "node:path";
import { AuthSlideshow, type AuthSlide } from "@/app/auth-slideshow";

const slides: AuthSlide[] = [
  {
    src: "/auth/signup1.jpg",
    alt: "Black woman doctor in a bright clinical setting",
    quote: "Every result carries a human story.",
    detail: "Precision in the laboratory helps clinicians care for the whole person.",
    label: "DOCTORS",
  },
  {
    src: "/auth/signup2.jpg",
    alt: "Black male clinician in a white coat",
    quote: "Care is strongest when we work together.",
    detail: "From the bedside to the laboratory, every thoughtful action matters.",
    label: "NURSES",
  },
  {
    src: "/auth/signup3.jpg",
    alt: "Black doctor speaking with a patient",
    quote: "Behind every discovery is a person who matters.",
    detail: "Your attention, expertise, and compassion move better care forward.",
    label: "CLINICIANS",
  },
];

export function AuthShowcase() {
  const availableSlides = slides.filter((slide) => existsSync(path.join(process.cwd(), "public", slide.src.slice(1))));
  return <AuthSlideshow slides={availableSlides} />;
}
