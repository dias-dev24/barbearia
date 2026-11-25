"use client";
import { useState } from "react";
import { Menu, X, Scissors } from "lucide-react";
export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="shell header-inner">
        <a className="brand" href="#inicio" aria-label="BRAVO, início">
          <Scissors size={27} strokeWidth={1.5} />
          <span>
            BRAVO<small>BARBEARIA</small>
          </span>
        </a>
        <nav className={open ? "nav is-open" : "nav"} aria-label="Navegação principal">
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
