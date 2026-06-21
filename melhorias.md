# Melhorias — Rebeka

Documento de backlog com sugestões de evolução do app, organizadas por prioridade e área.

**Referência:** avaliação do estado atual do projeto (arquitetura Wails + Go + Vanilla JS, UX estilo Insomnia).

---

## Sprint sugerida (prioridade alta)

Itens com maior impacto no fluxo principal: enviar → ver resposta → testar → repetir.

| # | Melhoria | Descrição |
|---|----------|-----------|
| 1 | Limpar session state ao trocar host/request | Além do workspace, resetar `response`, `testResults` e `requestSending` ao mudar host ou request ativa (evita resposta “fantasma” de outro contexto). |
| 2 | Atalho `Ctrl+Enter` para enviar | Enviar requisição sem clicar no botão; padrão em clientes HTTP. |
| 3 | Toast / feedback visual | Confirmar ações silenciosas: copiar URL, copiar body/headers, envio concluído, export .bek (substituir ou complementar `alert()`). |
| 4 | Console visível nos scripts | Hoje `console.log` é noop em `scriptRuntime.js`; expor saída na UI para debug de pre-request e tests. |
| 5 | Testes automatizados no `client/` Go | Cobrir interpolate, query params, auth bearer/basic, montagem de body — core crítico da ferramenta. |
| 6 | Histórico da última resposta por request | Guardar as últimas N respostas por request (como Insomnia/Postman), não só a sessão atual. |

---

## UX — impacto imediato

| Melhoria | Descrição |
|----------|-----------|
| Atalhos de teclado | `Ctrl+L` focar URL, `Ctrl+S` salvar, navegação entre abas do request/response. |
| Splitter drag request/response | Além do expand binário, permitir redimensionar manualmente a divisão vertical entre painéis. |
| Empty states ricos | Ícone + texto + CTA (“Criar request”, “Selecione na sidebar”) nos painéis vazios. |
| Loading skeleton | Usar `loading: true` do store ao trocar workspace/host — feedback visual durante hydrate. |
| Badge de status no response | Status code como pill colorida (classes `status-2xx` etc. já existem no CSS). |
| Badge de método na sidebar | GET/POST/PUT com cores das vars `--method-*` nos nós da árvore. |

---

## Produto — gap vs Postman / Insomnia

| Melhoria | Descrição |
|----------|-----------|
| Busca na sidebar | Filtrar requests/coleções por nome quando a árvore crescer. |
| Duplicar request / coleção | Ação rápida no menu contextual da árvore. |
| Cookies | Gerenciamento e envio automático em requests subsequentes. |
| Certificados SSL | Client cert / CA custom para ambientes corporativos. |
| Import OpenAPI / Swagger | Gerar coleção a partir de spec — acelera onboarding. |
| Histórico de envios (log) | Lista de requests executadas com timestamp, status e duração (além da resposta atual). |
| Redirect policy | Configurar se segue 301/302 ou não (comum em APIs). |
| Timeout por request na UI | Campo exposto; struct Go já tem `TimeoutSec`. |
| Proxy HTTP | Suporte a proxy corporativo. |
| Body grande / streaming | Evitar carregar response enorme inteiro na memória/UI de uma vez. |

---

## Arquitetura e código

| Melhoria | Descrição |
|----------|-----------|
| Bloco `session` no store | Agrupar `response`, `testResults`, `requestSending`, `responseExpanded` — facilita reset ao trocar contexto. |
| Re-render parcial do request-pane | Evitar `render()` completo ao trocar tab/método; atualizar só o painel ativo (menos perda de foco/cursor). |
| Documentar convenção de re-exports | Ex.: `components/request-pane/send.js` → `core/components/pane/request.js`. |
| Testes JS | `formatters`, `variables`, `scriptRuntime`, `buildUrlPreview`. |
| Smoke test E2E | Fluxo: criar request → enviar → ver response (Wails ou Playwright). |

---

## Backend / HTTP client (`client/`)

| Melhoria | Descrição |
|----------|-----------|
| Redirect policy configurável | Seguir ou não redirects; limite de hops. |
| Timeout configurável por request | Já parcialmente no model; falta UI e persistência. |
| Streaming / limite de body | Truncar ou stream para responses muito grandes. |
| Proxy | `http.Transport` com `ProxyURL`. |
| Melhor timeline | Detalhar DNS, connect, TLS, TTFB (quando possível no Go). |

---

## Polish visual

| Melhoria | Descrição |
|----------|-----------|
| Scrollbar customizada | ✅ Implementado em `global.css`. |
| Expand response-pane | ✅ Implementado (barra URL + preview permanecem visíveis). |
| Copy URL | ✅ Implementado. |
| Limpar response ao trocar workspace | ✅ Implementado. |
| Animação suave no expand | Transição CSS opcional no split vertical. |
| Modais WAFrame consistentes | Padronizar skin REBEK em todos os formulários. |

---

## Qualidade e confiança

| Melhoria | Descrição |
|----------|-----------|
| Testes unitários Go | `client/`, `storage/`, empacotamento `.bek` round-trip. |
| Testes unitários JS | Utils e store (mock do Wails bindings). |
| CI mínimo | `go test ./...` + lint frontend em PR. |
| Tratamento de erro na UI | Falhas de rede/Go com mensagem clara no response-pane (parcialmente existente via `resp.error`). |

---

## Avaliação resumida (baseline)

| Área | Nota | Observação |
|------|------|------------|
| Arquitetura | ⭐⭐⭐⭐ | Bem organizada para v1 |
| UX core (request/response) | ⭐⭐⭐⭐ | Próximo do Insomnia |
| Completude vs concorrentes | ⭐⭐⭐ | Falta histórico, import API, cookies |
| Performance | ⭐⭐⭐ | Expand otimizado; request-pane ainda re-renderiza muito |
| Robustez | ⭐⭐ | Poucos testes automatizados |
| Identidade visual | ⭐⭐⭐⭐ | Dark theme consistente, WAFrame integrado |

---

## O que já está indo bem

- Separação clara: `storage/`, `client/`, `frontend/src/core/`, componentes por pasta.
- Persistência SQLite centralizada no Go.
- Workspace → Host → árvore → request com variáveis, scripts e auth.
- Response: preview, raw, headers, timeline, expand, copy.
- Workflow visual + scheduler no backend.
- Export/import `.bek`, mirror de host/coleção.

---

## Próximos passos recomendados

1. Implementar itens 1–3 da sprint sugerida (session state, atalhos, toast).
2. Console de scripts + testes Go no client.
3. Histórico por request.
4. Busca na sidebar + duplicar request.

---

*Última atualização: junho/2026*
