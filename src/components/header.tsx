"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, X, Scissors } from "lucide-react";
export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onOutside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open]);
  return (
    <header ref={header} className={`header${scrolled ? " is-scrolled" : ""}`}>
      <div className="shell header-inner">
        <a className="brand" href="#inicio" aria-label="BRAVO, início">
          <Scissors size={27} strokeWidth={1.5} />
          <span>
            BRAVO<small>BARBEARIA</small>
          </span>
        </a>
        <nav
          id="main-navigation"
          className={open ? "nav is-open" : "nav"}
          aria-label="Navegação principal"
        >
          {[
            ["A experiência", "experiencia"],
            ["Serviços", "servicos"],
            ["Nossos barbeiros", "equipe"],
          ].map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a className="button button-small" href="#agendar" onClick={() => setOpen(false)}>
            Agendar horário
          </a>
        </nav>
        <button
          className="menu-toggle"
          ref={toggle}
          aria-controls="main-navigation"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
