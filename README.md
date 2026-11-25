# BRAVO · Barbearia

**Seu estilo. Sua assinatura.**

Site de barbearia com identidade visual própria e um painel de reservas em seis etapas. O visitante escolhe serviço, profissional, dia e horário, acompanha o resumo da reserva, revisa os dados e recebe um comprovante persistido no banco.

O agendamento usa opções contextuais, calendário mensal e horários disponíveis separados por manhã e tarde: não usa modelos de linguagem, chaves de API, assinaturas de IA ou tokens pagos. Não há painel administrativo.

> Projeto de portfólio. Marca, equipe, preços e reservas são fictícios. Não há atendimento, cobrança ou envio de mensagens reais. Use dados fictícios ao experimentar.

## Tecnologias

| Camada    | Escolha                                            |
| --------- | -------------------------------------------------- |
| Interface | Next.js App Router, React, TypeScript              |
| Estilo    | Tailwind CSS 4, CSS próprio e Lucide               |
| API       | Route Handlers com runtime Node.js                 |
| Validação | Zod, compartilhado entre cliente e servidor        |
| Banco     | SQLite, usando `node:sqlite`, com WAL e transações |
| Testes    | Node Test Runner, TSX e Playwright                 |
| Entrega   | GitHub Actions e Docker opcional                   |

## Executar localmente

Requer **Node.js 22.13+** e npm. O módulo SQLite dessa versão pode emitir um aviso de recurso experimental; os testes usam essa mesma API.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abra **http://localhost:3000**. O banco e as tabelas são criados automaticamente no primeiro acesso à API, em `data/bravo.sqlite`. Não é necessário instalar um servidor de banco, cadastrar conta ou fornecer segredo externo.

```sh
npm test             # regras, persistência, validação e proteção da API
npm run build        # build de produção
npm run typecheck    # TypeScript
npm run format:check # formatação
```

O projeto usa Webpack nos scripts para funcionar também em ambientes que restringem as portas internas do Turbopack.

### Testes no navegador

```sh
npx playwright install chromium
npm run test:e2e
```

Os testes iniciam um servidor próprio na porta 3100 e um banco separado em `test-results/e2e.sqlite`, com compilação isolada em `.next-e2e/` para permitir testes enquanto o site roda na porta 3000. Cobrem desktop e celular, menu, reserva completa, comprovante após recarregar, link preenchido para a Agenda Google, cancelamento e disputa simultânea pelo mesmo horário. Em Linux, a instalação das bibliotecas do navegador pode exigir `npx playwright install --with-deps chromium`.

Para usar um Chromium já instalado, informe o executável em `PLAYWRIGHT_CHROMIUM_PATH`. Capturas e traces ficam em `test-results/` e não são versionados.

## Experiência

- Design responsivo em preto, marfim e cobre, com fotografias locais.
- Serviços com preço e duração; links já selecionam o serviço no painel de reservas.
- Revelação suave de seções e movimento pontual, respeitando `prefers-reduced-motion`.
- Menu móvel, rótulos de formulário, foco visível e anúncios de erros para leitores de tela.
- Reservas em seis etapas, com fotos dos profissionais, calendário mensal, resumo com edição das escolhas e estados de carregamento, falha e agenda cheia.
- Comprovante restaurado na mesma sessão do navegador e link para adicionar o evento à Agenda Google, com serviço, profissional, data, duração e fuso preenchidos. O visitante confirma o salvamento no Google; cancelar no site não remove esse evento.
- Cancelamento mediante segredo aleatório, com confirmação antes de liberar o horário.

## Regras da agenda

- Fuso **America/Sao_Paulo**, com instantes de reserva em UTC−03:00.
- Terça a sexta, 09h–19h; sábado, 09h–17h. Domingo e segunda fechados.
- Almoço 12h–13h. O atendimento inteiro precisa caber na janela disponível.
- Início a cada 15 minutos, com antecedência mínima de 30 minutos.
- Reservas para hoje e até 30 dias à frente.
- Corte: 45 min / R$ 55; barba: 30 min / R$ 40; combo: 75 min / R$ 85.
- Cada barbeiro possui agenda independente. Qualquer sobreposição de duração é bloqueada.
- Preço e duração são definidos no servidor, independentemente dos valores enviados pelo navegador.
- A reserva usa `BEGIN IMMEDIATE`: a consulta final e a inserção acontecem na mesma transação. Uma disputa resulta em uma reserva e uma resposta `409`.
- Uma chave de idempotência evita duplicar reservas ao repetir uma solicitação. Em uma repetição válida, o segredo do comprovante é renovado.
- O cancelamento é idempotente e permitido antes do início do atendimento.

O catálogo fica em `src/lib/catalog.ts`, as regras de horário em `src/lib/schedule.ts` e a persistência em `src/lib/store.ts`.

## API

| Método | Rota                                                                | Finalidade                                        |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| GET    | `/api/availability?serviceId=corte&barberId=rafael&date=AAAA-MM-DD` | Horários livres, sem dados de clientes            |
| POST   | `/api/appointments`                                                 | Criar reserva e receber comprovante + token       |
| POST   | `/api/appointments/receipt`                                         | Recuperar comprovante usando `{ "token": "..." }` |
| DELETE | `/api/appointments/receipt`                                         | Cancelar usando `{ "token": "..." }`              |

Exemplo do corpo de criação:

```json
{
  "serviceId": "corte",
  "barberId": "rafael",
  "date": "AAAA-MM-DD",
  "time": "09:00",
  "name": "Cliente Exemplo",
  "phone": "11999999999",
  "consent": true,
  "requestId": "UUID-v4-gerado-no-cliente"
}
```

Envie `Content-Type: application/json`. Respostas de erro têm formato `{ "error": "mensagem" }`: `400` para dados inválidos, `403` para origem externa, `404` para comprovante inexistente, `409` para conflito, `413` para corpo acima de 4 KB, `415` para conteúdo incorreto e `429` para excesso de tentativas.

## Dados e limites da demonstração

O banco armazena nome, celular normalizado, consentimento, serviço, profissional, data, duração, valor e status. O segredo do comprovante tem 32 bytes aleatórios e somente seu SHA-256 é armazenado no banco. A interface guarda o segredo em `sessionStorage`, por isso fechar a sessão perde o acesso ao comprovante; a reserva continua persistida.

Não há listagem pública de reservas. As consultas de disponibilidade retornam apenas horários. Respostas da API usam `Cache-Control: no-store`, mutações validam a origem e o volume do corpo, e o limite básico é de oito tentativas por celular por hora. Esse limite não verifica a posse do número e não substitui proteção contra abuso em uma operação real.

Os dados demonstrativos permanecem no banco até sua remoção. Para reiniciar a demonstração, pare a aplicação e remova os arquivos `data/bravo.sqlite`, `data/bravo.sqlite-wal` e `data/bravo.sqlite-shm`, se existirem. Não faça isso com uma agenda real. O projeto não implementa recuperação de comprovante por SMS, notificações, pagamentos ou rotinas legais de retenção.

## Hospedagem

SQLite exige um processo Node.js com disco persistente. Use um servidor ou contêiner com volume; a aplicação atual não é adequada para gravar o banco em funções serverless com disco temporário ou em réplicas com bancos locais independentes. Para esse cenário, adapte a camada de persistência para um banco remoto.

```sh
docker compose up --build -d
```

O Compose declara um volume `bravo-data` para o banco e expõe a porta 3000. A imagem executa como usuário sem privilégios e usa o build standalone. Docker é uma alternativa de empacotamento; os testes automatizados usam Node diretamente.

Para produção sem Docker:

```sh
npm run build
npm run start
```

Configure `DATABASE_PATH` para um diretório persistente e gravável, fixe `APP_ORIGIN` na origem pública (por exemplo `https://bravo.exemplo.com`, sem barra final), use HTTPS no proxy e faça backup consistente do SQLite (incluindo o estado WAL ou usando a API de backup do banco). O site é demonstrativo e está marcado como `noindex`.

## Organização

```text
src/app/                 Página, layout e endpoints REST
src/components/          Menu, animações e chatbot de agendamento
src/lib/catalog.ts       Catálogo demonstrativo
src/lib/schedule.ts      Datas, validações e disponibilidade teórica
src/lib/store.ts         Schema, transações e comprovantes
src/lib/http.ts          Proteções e erros HTTP
tests/booking.test.ts    Testes de regras e banco
tests/e2e/               Testes de navegador e concorrência HTTP
.github/workflows/       Verificação automatizada
```

## Entregas

- [x] Etapa 1: identidade BRAVO e página responsiva.
- [x] Etapa 2: API, SQLite e chatbot de agendamento.
- [x] Etapa 3: testes, documentação e preparação para hospedagem.

As etapas são commits separados, enviados ao GitHub.

## Créditos de imagem

Fotografias ilustrativas do [Unsplash](https://unsplash.com/license), baixadas e servidas localmente. Retratos representam personagens fictícios, sem sugerir vínculo ou endosso das pessoas fotografadas.

- [Foto principal](https://images.unsplash.com/photo-1503951914875-452162b0f3f1)
- [Experiência](https://images.unsplash.com/photo-1621605815971-fbc98d665033)
- [Retrato 1](https://images.unsplash.com/photo-1500648767791-00dcc994a43e)
- [Retrato 2](https://images.unsplash.com/photo-1535713875002-d1d0cf377fde)
- [Retrato 3](https://images.unsplash.com/photo-1506794778202-cad84cf45f1d)
