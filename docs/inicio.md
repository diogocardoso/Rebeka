# Introdução

Bem-vindo ao **Rebeka** — cliente HTTP desktop para testar APIs localmente ou na web.

## O que você pode fazer

- Organizar requisições em **coleções** (pastas na sidebar)
- Alternar entre **ambientes** (Local, Homolog, Produção…) com URLs e variáveis diferentes
- Enviar requests com params, headers, body e autenticação
- Validar respostas com **scripts de teste**
- Automatizar sequências com **workflows**
- Fazer backup e compartilhar projetos com arquivos **.bek**

## Layout da tela

```text
┌─────────────────────────────────────────────────────────────┐
│  Header: Workspace · Ambiente · Requisição / Workflow       │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  Painel central                              │
│  · Coleções  │  · Request (envio)                           │
│  · Variáveis │  · Response (resposta)                       │
│  · Scripts   │  · Console / Resultados dos testes           │
│  · Docs      │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

## Primeiros passos

1. Selecione ou crie um **workspace** no header (canto superior).
2. Escolha um **ambiente** no seletor ao lado — ele define a URL base (`baseUrl`).
3. Na sidebar, crie uma **pasta** ou **requisição**.
4. Clique na requisição, preencha método e path, e pressione **Enviar**.

> **Dica:** abra **Documentação** no rodapé da sidebar sempre que precisar de ajuda sobre um recurso.

## Persistência

Tudo é salvo automaticamente no seu computador. Ao fechar e reabrir o app, workspace, coleções, ambientes e requisições continuam onde você parou.
