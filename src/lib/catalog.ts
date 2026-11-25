export const services = [
  {
    id: "corte",
    name: "Corte de cabelo",
    description: "Do clássico ao degradê. Um corte que combina com você, finalizado nos detalhes.",
    price: 55,
    duration: 45,
    tag: "SEU ESTILO, SUA ASSINATURA",
  },
  {
    id: "barba",
    name: "Barba completa",
    description: "Toalha quente, navalha e acabamento preciso. Um ritual que faz a diferença.",
    price: 40,
    duration: 30,
    tag: "RESPEITO A CADA DETALHE",
  },
  {
    id: "combo",
    name: "Corte + barba",
    description: "O cuidado completo. Cabelo e barba em harmonia, com tempo para fazer bem-feito.",
    price: 85,
    duration: 75,
    tag: "A EXPERIÊNCIA COMPLETA",
  },
] as const;
export const barbers = [
  { id: "rafael", name: "Rafael Costa", initials: "RC", specialty: "Clássicos & tesoura" },
  { id: "lucas", name: "Lucas Almeida", initials: "LA", specialty: "Degradê & estilo urbano" },
  { id: "andre", name: "André Santos", initials: "AS", specialty: "Barba & visagismo" },
] as const;
export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
