# Requisições HTTP

## Criar requisição

1. Na sidebar, clique em **+** (nova requisição) ou crie dentro de uma pasta.
2. Selecione a requisição na árvore — ela abre no painel central.

## Barra de envio

| Elemento | Função |
|----------|--------|
| **Método** | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| **Modo Host / URL** | Path relativo à base URL ou URL completa |
| **Path / URL** | Endereço da rota (suporta `{{variáveis}}`) |
| **Preview** | URL final montada antes do envio |
| **Enviar** | Executa a requisição |

Atalho: **Ctrl+Enter** envia a requisição ativa.

---

## Abas da requisição

### Params

Query string (`?chave=valor`). Cada linha pode ser habilitada ou desabilitada individualmente.

### Headers

Cabeçalhos HTTP customizados. Use variáveis quando necessário (`Authorization: Bearer {{token}}`).

### Body

Tipos disponíveis:

| Tipo | Uso |
|------|-----|
| Nenhum | GET sem corpo |
| JSON | APIs REST |
| Texto | Payload plain text |
| URL Encoded | Formulários `application/x-www-form-urlencoded` |
| Form Data | Upload / multipart |

### Auth

| Tipo | Descrição |
|------|-----------|
| Nenhum | Sem autenticação automática |
| Bearer Token | Header `Authorization: Bearer …` |
| Basic Auth | Usuário e senha codificados |

Tokens e credenciais aceitam `{{variáveis}}`.

### Pre-request

Script executado **antes** do envio. Útil para montar headers dinâmicos ou preparar dados.

### Tests

Script executado **depois** da resposta. Valide status, body e salve variáveis — veja o guia **Testes e scripts**.

---

## Resposta

Após enviar, a área inferior exibe:

- **Status** HTTP, **tempo** (ms) e **tamanho** (bytes)
- Corpo com highlight (JSON, XML, HTML) ou aba Raw
- Headers copiáveis
- **Console** — saída de `console.log` dos scripts
- **Resultados dos testes** — Passou / Falhou

Use o botão de expandir para focar na resposta.

---

## Histórico

Cada requisição guarda um histórico das últimas execuções (status, body, tempo). Útil para comparar respostas entre envios.

---

## Organizar coleções

- **Pastas** agrupam requisições relacionadas
- **Arraste e solte** na árvore para reordenar ou mover entre pastas
- **Renomear:** duplo clique no nome ou menu de ações (⚙)
- **Excluir:** menu de ações da pasta ou requisição
