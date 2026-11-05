<p align="center">
  <img src="src/renderer/assets/logo-resizer.png" alt="ARC Image Resizer" width="520">
</p>

# ARC Image Resizer

Aplicativo para Windows que comprime e redimensiona imagens em lote. Todo o processamento é local: nenhuma imagem é enviada para a internet e os arquivos originais nunca são alterados.

## Como usar

Na parte superior do aplicativo, escolha uma das duas ferramentas.

### Compressor

1. Selecione imagens JPG, JPEG ou PNG — ou uma pasta completa.
2. Escolha **Sem perda** para preservar todos os pixels ou **Redução forte** para arquivos menores com alta qualidade.
3. Defina a pasta de saída e clique em **Otimizar imagens**.

### Resizer

1. Selecione as imagens ou uma pasta completa.
2. Escolha como redimensionar:
   - **Dimensões:** informe largura e altura em pixels.
   - **Porcentagem:** reduza ou amplie em relação ao tamanho original.
   - **Redes sociais:** use formatos prontos para Instagram, Facebook, X, TikTok, LinkedIn e YouTube.
3. Use o controle de proporção para preservar a imagem sem deformação ou liberar largura e altura independentes.
4. Clique em **Redimensionar**.

Cada execução cria uma subpasta exclusiva, como `Lote 2026-11-05 14-30-12` ou `Redimensionado 2026-11-05 14-30-12`. Ao terminar, o app mostra o caminho completo e oferece um botão para abrir a pasta.

## Recursos

- Processamento de até quatro imagens simultaneamente.
- Presets para posts, capas, perfis, anúncios, stories, reels, shorts e thumbnails.
- Alta qualidade para JPG e PNG.
- Interface separada em abas, preservando o lote de cada ferramenta.
- Funcionamento offline e originais protegidos.

## Desenvolvimento

Requer [Node.js](https://nodejs.org/) 22 ou superior.

```powershell
npm install
npm start
```

Para testar e gerar o instalador do Windows:

```powershell
npm test
npm run dist
```

O instalador será criado na pasta `release`.

## Licença

Distribuído sob a licença MIT.
