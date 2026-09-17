# AutoStamp PDF

Editor local de carimbos em PDF, em português, com análise opcional pela API OpenAI. O projeto nasceu de rotinas de escritório: identificar dados da empresa, revisar o texto do carimbo, ajustar sua posição em cada página e salvar uma cópia do PDF.

**Versão inicial: 0.1.0.** Mantido por Rômulo Nogueira Oliveira do Carmo ([BrandLionCorporate](https://github.com/BrandLionCorporate)). Ainda não há métricas públicas de adoção ou downloads. Correções e contribuições são bem-vindas.

## Recursos

- Visualização de PDFs com PDF.js distribuído junto com a aplicação.
- Edição de texto, data, tamanho e posição dos carimbos por página.
- Geração do PDF carimbado no navegador com pdf-lib.
- Análise opcional de dados empresariais e posições pela Responses API da OpenAI.
- Edição manual disponível quando a API não estiver configurada ou a análise falhar.

O carimbo é uma anotação visual. O programa não cria uma assinatura digital, não certifica autenticidade e não valida juridicamente o documento. Revise os dados e as páginas antes de usar a cópia gerada.

## Instalação

Requisitos: Node.js 24 e pnpm 11.19.0. Em uma instalação padrão de Node.js, instale o pnpm com `npm install --global pnpm@11.19.0`.

```bash
git clone https://github.com/BrandLionCorporate/autostamp-pdf-ai.git
cd autostamp-pdf-ai
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Abra **http://127.0.0.1:3000**. O servidor aceita conexões somente do computador local. Para desenvolver, use `pnpm dev`.

### Análise opcional por IA

Copie `.env.example` para `.env.local` e configure `OPENAI_API_KEY` somente nesse arquivo ou nas variáveis do servidor. `OPENAI_MODEL` permite escolher um modelo disponível na sua conta com visão e Structured Outputs. Sem chave, a edição manual continua disponível.

O uso da API tem cobrança separada da assinatura ChatGPT. Não publique a chave e não a coloque no frontend.

## Dados e privacidade

Ao carregar um PDF com a API configurada, o aplicativo envia à OpenAI imagens da primeira e da última página e o texto extraído de até cinco páginas iniciais, além da última. A requisição utiliza `store: false`; o tratamento na API continua sujeito às políticas aplicáveis da OpenAI. Envie apenas documentos que você tem autorização para processar.

O aplicativo não implementa armazenamento de PDFs no servidor. A edição e a geração do arquivo final ocorrem no navegador. A distribuição não inclui documentos de clientes, credenciais ou logs da instalação original.

O servidor é destinado ao uso local. Não o exponha diretamente na internet: ele não possui autenticação de usuários, controle de cobrança por usuário ou isolamento de múltiplos clientes.

## Verificação

```bash
pnpm typecheck
pnpm build
pnpm test
```

Os testes verificam a inicialização em produção, os recursos estáticos, o modo sem chave e a recusa de origens externas. Eles não chamam a API OpenAI. A extração automática depende de chave, permissões, créditos e disponibilidade do modelo; os resultados precisam de revisão humana.

## Próximos passos

- Mais testes com PDFs sintéticos de vários formatos e tamanhos.
- Melhorias de acessibilidade e navegação por teclado.
- Melhor tratamento de documentos grandes e casos de OCR difíceis.
- Revisão de issues e pull requests com foco em privacidade e reprodução de problemas.

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para contribuir e [SECURITY.md](SECURITY.md) para relatar problemas de segurança. Código disponibilizado sob [licença MIT](LICENSE); as dependências mantêm suas próprias licenças.
