# canvas-scraper

Web Scraper para la plataforma de educación "Canvas"

## Motivación

La plataforma "Canvas" es una herramienta de educación utilizada por la Universidad de la Rioja
Internacional ([https://mexico.unir.net/](https://mexico.unir.net/)). La manera en que el material
para el estudiante se sube, no es la forma más ergonómica que existe, ya que sólo se puede leer
en el navegador o descargando cada tema en formato PDF. El cual no está mal, pero no se puede editar
o combinar en un sólo archivo.

En mi opinión personal, es mejor tener el texto con las imágenes en un formato "Markdown" y poder
exportar ese texto a cualquier otro formato que sea necesario, como PDF, utilizando
[Pandoc](https://pandoc.org/) y [LateX](https://www.latex-project.org/)

Este repositorio es el sucesor del
[primer intento](https://github.com/victorhqc/ARCHIVED_canvas-scraper).

## Alcance

El proyecto tiene como alcance generar una aplicación para la terminal (CLI) que pueda:

- Iniciar sesión en Canvas (Necesario para poder realizar el scraping)
- Convertir el material en HTML a un archivo Markdown
- Automáticamente descargar las imágenes y usarlas en el archivo Markdown.

El formateo post Markdown no forma parte de la especificación y se recomienda utilizar otras
herramientas como [Pandoc](https://pandoc.org/) y [LateX](https://www.latex-project.org/).

## Requisitos

- Node >= 12.13.1
- npm >= 6.12.1

## Instalación

```sh
npx canvas-scraping parse -u <USUARIO>

# O con instalación global (Sólo instalarlo una vez)
npm i -g canvas-scraping

canvas-scraping parse -u <USUARIO>
```

## Comandos

```sh
canvas-scraping <COMANDO> <ARGUMENTOS>

# Ejemplo
canvas-scraping parse -u FOO -p BAR
```

**Parse**: Obtiene el contenido de un curso y crea archivos de Markdown para cada tema.

Argumentos:

- `help`: Muestra la ayuda del comando
- `u` o `username`: Usuario de Canvas.
- `p` o `password`: Contraseña de usuario.
- `t` o `target`: Directorio donde se guardará el contenido.

## Desarrollo

### Ejecución

```sh
# Development
npm run build -- --watch

# Production
NODE_ENV=production npm run build

node ./dist/main.js parse
```
