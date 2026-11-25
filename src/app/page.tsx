import Image from "next/image";
import { Scissors, Clock3, Sparkles, Coffee, MapPin, Check } from "lucide-react";
import { Header } from "@/components/header";
import { BookingChat } from "@/components/booking-chat";
import { Reveal } from "@/components/reveal";
import { services, barbers, money } from "@/lib/catalog";
export default function Home() {
  return <><Header/><main id="inicio">
    <section className="hero">
      <Image className="hero-photo" src="/images/hero.jpg" alt="Barbeiro aparando a barba de um cliente com tesoura" fill priority sizes="100vw"/>
      <div className="hero-shade"/>
      <div className="shell hero-content"><p className="eyebrow"><span/> MAIS QUE UM CORTE. UM RITUAL.</p>
        <h1>Seu estilo.<br/>Sua <em>assinatura.</em></h1>
        <p className="hero-description">Um bom corte muda o visual.<br/>Uma boa experiência muda o seu dia.</p>
        <div className="hero-actions"><a className="button" href="#agendar"><Scissors size={18}/> Reserve seu momento</a><a className="text-link" href="#servicos">Explore os serviços</a></div>
        <div className="hero-note"><span className="note-line"/> FEITO COM PRECISÃO. PENSADO PARA VOCÊ.</div>
      </div>
      <div className="hero-caption"><span>BRAVO EXPERIENCE</span><small>Tradição no cuidado. Atitude no estilo.</small></div>
      <a href="#experiencia" className="scroll-hint" aria-label="Conheça a experiência"><span/> SCROLL PARA DESCOBRIR</a>
    </section>
    <div className="values-strip"><div className="shell"><span><Scissors/>Cortes com personalidade</span><i/><span><Coffee/>Café e boa conversa</span><i/><span><Clock3/>Seu tempo valorizado</span><i/><span><Sparkles/>Cuidado em cada detalhe</span></div></div>
    <section id="experiencia" className="section shell experience" data-reveal>
      <div className="experience-photo"><Image src="/images/experience.jpg" alt="Barbeiro trabalhando com atenção no acabamento de um corte" fill sizes="(max-width: 760px) 100vw, 45vw"/><div className="photo-stamp"><Scissors size={26}/><span>O BOM ESTILO<br/>ESTÁ NOS DETALHES.</span></div></div>
      <div className="experience-copy"><p className="eyebrow">BEM-VINDO À BRAVO</p><h2>Uma pausa na rotina.<br/><em>Um encontro com você.</em></h2><p>A gente acredita que ir à barbearia pode ser a melhor parte da sua semana. Sentar na cadeira, tomar um café e deixar o resto com quem entende.</p><p>Aqui, técnica encontra personalidade. Cada corte começa com uma conversa e termina com você se reconhecendo no espelho.</p><div className="signature">Cuidado de verdade. Sem pressa.</div><a className="underlined-link" href="#agendar">Viva a experiência BRAVO</a></div>
    </section>
    <section id="servicos" className="services-section section"><div className="shell"><div className="section-heading" data-reveal><div><p className="eyebrow">NA MEDIDA DO SEU ESTILO</p><h2>O cuidado que<br/><em>você merece.</em></h2></div><p>Técnica, atenção e aquele acabamento<br className="desktop"/> que você percebe nos detalhes.</p></div><div className="service-grid">
      {services.map((service, index) => <article className={`service-card ${index === 2 ? "featured" : ""}`} key={service.id} data-reveal>{index === 2 && <span className="service-badge">COMBINAÇÃO BRAVO</span>}<div className="service-icon">{index === 1 ? <span className="razor-icon">⌁</span> : index === 2 ? <Sparkles size={29}/> : <Scissors size={29}/>}</div><p className="card-eyebrow">{service.tag}</p><h3>{service.name}</h3><p>{service.description}</p><div className="service-meta"><strong>{money(service.price)}</strong><span><Clock3 size={14}/>{service.duration} min</span></div><a className="service-book" href={`/?servico=${service.id}#agendar`}>Escolher esse cuidado <span>+</span></a></article>)}
    </div><p className="services-footnote">Cada serviço inclui uma boa conversa, café e atenção de sobra.</p></div></section>
    <section id="equipe" className="section shell team" data-reveal><div className="section-heading"><div><p className="eyebrow">TALENTO EM BOAS MÃOS</p><h2>Quem cuida<br/><em>do seu estilo.</em></h2></div><p>Gente que gosta do que faz.<br/>E faz questão de fazer bem.</p></div><div className="team-grid">{barbers.map((barber, i) => <article className="team-card" key={barber.id}><div className={`barber-image barber-image-${i}`}><Image src={`/images/barber-${i + 1}.jpg`} alt={`Retrato ilustrativo do barbeiro ${barber.name}`} fill sizes="(max-width: 600px) 100vw, 33vw"/><span className="barber-mark"><Scissors size={20}/></span></div><div className="barber-info"><h3>{barber.name}</h3><p>{barber.specialty}</p></div></article>)}</div><p className="demo-caption">Equipe e marca fictícias, criadas para este projeto de portfólio. Fotos ilustrativas.</p></section>
    <section className="quote-section" data-reveal><div className="shell"><Scissors size={32}/><p>Estilo é se sentir bem<br/>sendo <em>você mesmo.</em></p><span>ESSE É O NOSSO MELHOR ACABAMENTO.</span></div></section>
    <section id="agendar" className="section shell booking-section"><div className="booking-copy"><p className="eyebrow">SEU PRÓXIMO BOM MOMENTO</p><h2>Sua cadeira<br/>está <em>te esperando.</em></h2><p>Escolha o cuidado, o profissional e o melhor horário. Nossa recepção digital cuida do resto.</p><ul className="booking-benefits"><li><Check/>Agende em poucos passos</li><li><Check/>Horários disponíveis em tempo real</li><li><Check/>Sem cadastro, sem complicação</li></ul><div className="location-card"><MapPin size={22}/><div><strong>Um espaço para chamar de seu.</strong><p>Terça a sexta · 09h às 19h<br/>Sábado · 09h às 17h</p><small>Unidade demonstrativa · São Paulo, SP</small></div></div></div><BookingChat/></section>
  </main><footer><div className="shell footer-main"><a className="brand" href="#inicio"><Scissors size={27}/><span>BRAVO<small>BARBEARIA</small></span></a><p>Seu estilo. Sua assinatura.</p><a href="#agendar" className="footer-cta">Seu próximo corte começa aqui.</a></div><div className="shell footer-bottom"><span>© {new Date().getFullYear()} BRAVO. Projeto de portfólio.</span><span>Marca fictícia · Agendamentos demonstrativos</span><a href="https://github.com/dias-dev24/barbearia" target="_blank" rel="noreferrer">Conheça o projeto no GitHub</a></div></footer><Reveal/></>;
}
