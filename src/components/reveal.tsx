"use client";
import { useEffect } from "react";
export function Reveal() {
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      el.classList.add("reveal-ready");
      observer.observe(el);
    });
    const showAll = () => {
      if (preference.matches) {
        document.querySelectorAll(".reveal-ready").forEach((el) => el.classList.add("revealed"));
        observer.disconnect();
      }
    };
    preference.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", showAll);
    };
  }, []);
  return null;
}
