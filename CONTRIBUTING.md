# Como contribuir

Este é um projeto em estágio inicial. Abra uma issue com o comportamento esperado, o resultado observado e os passos para reproduzir. Use somente PDFs sintéticos ou anonimizados: não anexe documentos de clientes, chaves, tokens, assinaturas pessoais ou dados de terceiros.

Para uma alteração:

1. Crie uma branch a partir de `main`.
2. Instale as dependências com `pnpm install --frozen-lockfile`.
3. Faça uma mudança focada e documente qualquer novo requisito.
4. Execute `pnpm typecheck`, `pnpm build` e `pnpm test`.
5. Envie um pull request descrevendo o problema e como verificou a solução.

A análise real pela OpenAI não é exigida para contribuir e não deve usar dados privados em testes. Nunca inclua `.env.local` no commit. Ao contribuir, disponibilize suas alterações sob a licença MIT do projeto.
