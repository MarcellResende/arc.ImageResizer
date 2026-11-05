<p align="center">
  <img src="src/renderer/assets/logo.png" alt="ARC Image Resizer" width="520">
</p>

# ARC Image Resizer

Aplicativo para Windows que otimiza imagens em lote **sem perda de qualidade**. Todo o processamento acontece localmente: nenhuma imagem é enviada para a internet e os arquivos originais nunca são alterados.

## Como usar

1. Abra o ARC Image Resizer.
2. Selecione imagens ou uma pasta completa.
3. Escolha a pasta onde os resultados serão armazenados.
4. Selecione a intensidade **Equilibrada** ou **Máxima**.
5. Clique em **Otimizar imagens**.

Cada processamento cria automaticamente uma nova subpasta, como `Lote 2026-11-05 14-30-12`. Assim, lotes diferentes não misturam arquivos nem geram nomes com `(2)`.

## Formatos suportados

- JPG e JPEG: otimização das tabelas internas sem recodificar os pixels.
- PNG: recompressão lossless, mantendo os pixels intactos.

Se a versão otimizada não ficar menor, o aplicativo salva uma cópia idêntica do original.

## Desenvolvimento

Requer [Node.js](https://nodejs.org/) 22 ou superior.

```powershell
npm install
npm start
```

Para executar os testes e gerar o instalador do Windows:

```powershell
npm test
npm run dist
```

O instalador será criado na pasta `release`.

## Privacidade

O aplicativo funciona offline. As imagens permanecem somente no computador do usuário.

## Licença

Distribuído sob a licença MIT.
